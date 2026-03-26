import { describe, it, expect, vi } from 'vitest';
import { loadFavoritosFromDB, loadNotasFromDB, saveNota, createLS } from '../lib/core.js';

/* ── Helpers ── */
function mockStorage() {
  const store = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
    _store: store,
  };
}

const KEYS = { lib: 'scs2_fav_lib', lec: 'scs2_fav_lec', quo: 'scs2_fav_quo' };
const NOTAS_K = 'scs2_notas';

/* ═══════════════════════════════════════════
   loadFavoritosFromDB
═══════════════════════════════════════════ */
describe('loadFavoritosFromDB', () => {

  it('carga favoritos desde Supabase correctamente', async () => {
    const sbFetch = vi.fn().mockResolvedValue([
      { tipo: 'libro', item_id: 'L1' },
      { tipo: 'libro', item_id: 'L2' },
      { tipo: 'leccion', item_id: 'LEC5' },
      { tipo: 'cita', item_id: 'Q3' },
    ]);
    const ls = createLS(mockStorage());

    const cache = await loadFavoritosFromDB(sbFetch, ls, KEYS);
    expect(cache.libro).toEqual(['L1', 'L2']);
    expect(cache.leccion).toEqual(['LEC5']);
    expect(cache.cita).toEqual(['Q3']);
    expect(sbFetch).toHaveBeenCalledOnce();
  });

  it('fallback a localStorage si Supabase falla', async () => {
    const sbFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const storage = mockStorage();
    const ls = createLS(storage);
    ls.set(KEYS.lib, ['L9']);
    ls.set(KEYS.lec, ['LEC1', 'LEC2']);
    ls.set(KEYS.quo, []);

    const cache = await loadFavoritosFromDB(sbFetch, ls, KEYS);
    expect(cache.libro).toEqual(['L9']);
    expect(cache.leccion).toEqual(['LEC1', 'LEC2']);
    expect(cache.cita).toEqual([]);
  });

  it('devuelve arrays vacíos si Supabase devuelve null', async () => {
    const sbFetch = vi.fn().mockResolvedValue(null);
    const ls = createLS(mockStorage());

    const cache = await loadFavoritosFromDB(sbFetch, ls, KEYS);
    expect(cache.libro).toEqual([]);
    expect(cache.leccion).toEqual([]);
    expect(cache.cita).toEqual([]);
  });

  it('ignora tipos desconocidos de Supabase', async () => {
    const sbFetch = vi.fn().mockResolvedValue([
      { tipo: 'libro', item_id: 'L1' },
      { tipo: 'inexistente', item_id: 'X1' },
    ]);
    const ls = createLS(mockStorage());

    const cache = await loadFavoritosFromDB(sbFetch, ls, KEYS);
    expect(cache.libro).toEqual(['L1']);
    expect(cache).not.toHaveProperty('inexistente');
  });

  it('fallback devuelve [] si localStorage tampoco tiene datos', async () => {
    const sbFetch = vi.fn().mockRejectedValue(new Error('offline'));
    const ls = createLS(mockStorage());

    const cache = await loadFavoritosFromDB(sbFetch, ls, KEYS);
    expect(cache.libro).toEqual([]);
    expect(cache.leccion).toEqual([]);
    expect(cache.cita).toEqual([]);
  });
});

/* ═══════════════════════════════════════════
   loadNotasFromDB
═══════════════════════════════════════════ */
describe('loadNotasFromDB', () => {

  it('carga notas desde Supabase', async () => {
    const sbFetch = vi.fn().mockResolvedValue([
      { leccion_id: 'LEC1', texto: 'Mi nota sobre Kahneman' },
      { leccion_id: 'LEC5', texto: 'Reflexión sobre Taleb' },
    ]);
    const ls = createLS(mockStorage());

    const cache = await loadNotasFromDB(sbFetch, ls, NOTAS_K);
    expect(cache['LEC1']).toBe('Mi nota sobre Kahneman');
    expect(cache['LEC5']).toBe('Reflexión sobre Taleb');
  });

  it('fallback a localStorage si Supabase falla', async () => {
    const sbFetch = vi.fn().mockRejectedValue(new Error('timeout'));
    const storage = mockStorage();
    const ls = createLS(storage);
    ls.set(NOTAS_K, { 'LEC3': 'nota local' });

    const cache = await loadNotasFromDB(sbFetch, ls, NOTAS_K);
    expect(cache['LEC3']).toBe('nota local');
  });

  it('devuelve {} si Supabase devuelve null', async () => {
    const sbFetch = vi.fn().mockResolvedValue(null);
    const ls = createLS(mockStorage());

    const cache = await loadNotasFromDB(sbFetch, ls, NOTAS_K);
    expect(cache).toEqual({});
  });

  it('Supabase vacío devuelve {}', async () => {
    const sbFetch = vi.fn().mockResolvedValue([]);
    const ls = createLS(mockStorage());

    const cache = await loadNotasFromDB(sbFetch, ls, NOTAS_K);
    expect(cache).toEqual({});
  });
});

/* ═══════════════════════════════════════════
   saveNota
═══════════════════════════════════════════ */
describe('saveNota', () => {

  it('guarda en cache, localStorage y Supabase', async () => {
    const sbFetch = vi.fn().mockResolvedValue({});
    const storage = mockStorage();
    const ls = createLS(storage);
    const notasCache = {};

    const ok = await saveNota(sbFetch, ls, NOTAS_K, notasCache, 'LEC1', 'Nueva nota');

    expect(ok).toBe(true);
    expect(notasCache['LEC1']).toBe('Nueva nota');
    expect(ls.get(NOTAS_K, {})['LEC1']).toBe('Nueva nota');
    expect(sbFetch).toHaveBeenCalledOnce();
  });

  it('guarda en cache y localStorage aunque Supabase falle', async () => {
    const sbFetch = vi.fn().mockRejectedValue(new Error('DB error'));
    const storage = mockStorage();
    const ls = createLS(storage);
    const notasCache = {};

    const ok = await saveNota(sbFetch, ls, NOTAS_K, notasCache, 'LEC2', 'Nota offline');

    expect(ok).toBe(false);
    expect(notasCache['LEC2']).toBe('Nota offline');
    expect(ls.get(NOTAS_K, {})['LEC2']).toBe('Nota offline');
  });

  it('sobrescribe nota existente', async () => {
    const sbFetch = vi.fn().mockResolvedValue({});
    const storage = mockStorage();
    const ls = createLS(storage);
    const notasCache = { 'LEC1': 'Vieja' };

    await saveNota(sbFetch, ls, NOTAS_K, notasCache, 'LEC1', 'Actualizada');

    expect(notasCache['LEC1']).toBe('Actualizada');
    expect(ls.get(NOTAS_K, {})['LEC1']).toBe('Actualizada');
  });

  it('preserva otras notas en localStorage al guardar', async () => {
    const sbFetch = vi.fn().mockResolvedValue({});
    const storage = mockStorage();
    const ls = createLS(storage);
    ls.set(NOTAS_K, { 'LEC_PREV': 'Existente' });
    const notasCache = {};

    await saveNota(sbFetch, ls, NOTAS_K, notasCache, 'LEC_NEW', 'Otra');

    const stored = ls.get(NOTAS_K, {});
    expect(stored['LEC_PREV']).toBe('Existente');
    expect(stored['LEC_NEW']).toBe('Otra');
  });
});
