import { describe, it, expect } from 'vitest';
import Mazo from '../lib/mazo.js';

const L = (id, libro, orden, extra) => Object.assign({ id, libro_id: libro, orden, titulo: 'T' + id, idea_clave: 'Una idea clave suficientemente larga ' + id, autocorreccion: 'Un matiz largo que matiza la idea y añade contrapunto suficiente para la ficha ' + id, cita_memorable: 'Una cita memorable ' + id }, extra || {});
const lecs = [L('a', 'B1', 1), L('b', 'B1', 2), L('c', 'B1', 3), L('d', 'B2', 1), L('e', 'B2', 2), L('f', 'B3', 1)];

describe('Mazo.componer', () => {
  it('cinco fichas como mucho, terminando en cierre', () => {
    const m = Mazo.componer({ lecs, completadas: new Set(['a', 'd']), siguiente: lecs[1], semilla: 1 });
    expect(m.length).toBeLessThanOrEqual(5);
    expect(m[m.length - 1].tipo).toBe('cierre');
  });
  it('empieza recordando algo leído y sigue con la lección que toca y la siguiente del mismo libro', () => {
    const m = Mazo.componer({ lecs, completadas: new Set(['a', 'd']), siguiente: lecs[1], semilla: 2 });
    expect(m[0].tipo).toBe('recuerda');
    expect(['a', 'd']).toContain(m[0].lecId);
    expect(m[1]).toMatchObject({ tipo: 'idea', lecId: 'b', siguiente: true });
    expect(m[2]).toMatchObject({ tipo: 'idea', lecId: 'c' });
    expect(m[4]).toMatchObject({ tipo: 'cierre', lecId: 'b' });
  });
  it('si hay lectura a medias, la primera ficha es reanudarla y el cierre la ofrece', () => {
    const m = Mazo.componer({ lecs, completadas: new Set(), siguiente: lecs[0], reanudar: { lec: lecs[4], restante: 3 }, semilla: 3 });
    expect(m[0]).toMatchObject({ tipo: 'reanudar', lecId: 'e', restante: 3 });
    expect(m[m.length - 1]).toMatchObject({ tipo: 'cierre', lecId: 'e' });
  });
  it('no repite lecciones dentro del mazo', () => {
    for (let s = 0; s < 20; s++) {
      const m = Mazo.componer({ lecs, completadas: new Set(['a', 'b']), siguiente: lecs[2], semilla: s });
      const ids = m.filter(f => f.tipo !== 'cierre').map(f => f.lecId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it('sin nada leído no hay ficha de recuerdo, pero sí ideas', () => {
    const m = Mazo.componer({ lecs, completadas: new Set(), siguiente: null, semilla: 4 });
    expect(m.some(f => f.tipo === 'recuerda')).toBe(false);
    expect(m.filter(f => f.tipo === 'idea').length).toBe(2);
  });
  it('evita lo visto hace poco si hay alternativas', () => {
    const m = Mazo.componer({ lecs, completadas: new Set(), siguiente: null, vistas: ['a', 'b', 'c', 'd'], semilla: 5 });
    m.filter(f => f.tipo === 'idea').forEach(f => expect(['e', 'f']).toContain(f.lecId));
  });
  it('corpus vacío → solo el cierre', () => {
    expect(Mazo.componer({ lecs: [], semilla: 1 })).toEqual([{ tipo: 'cierre', lecId: null }]);
  });
});

describe('Mazo.decidirReanudar', () => {
  const ahora = 1_000_000_000;
  it('reabre una lectura activa reciente', () => {
    expect(Mazo.decidirReanudar({ lecId: 'x', ts: ahora - 3600e3, activa: true, y: 0.4 }, ahora, new Set())).toBe('abrir');
  });
  it('si ya la terminaste, nada', () => {
    expect(Mazo.decidirReanudar({ lecId: 'x', ts: ahora - 1000, activa: true }, ahora, new Set(['x']))).toBeNull();
  });
  it('antigua o no activa pero avanzada → ficha; sin avance → nada', () => {
    expect(Mazo.decidirReanudar({ lecId: 'x', ts: ahora - 20 * 3600e3, activa: true, y: 0.3 }, ahora, new Set())).toBe('ficha');
    expect(Mazo.decidirReanudar({ lecId: 'x', ts: ahora - 3600e3, activa: false, y: 0.3 }, ahora, new Set())).toBe('ficha');
    expect(Mazo.decidirReanudar({ lecId: 'x', ts: ahora - 3600e3, activa: false, y: 0 }, ahora, new Set())).toBeNull();
    expect(Mazo.decidirReanudar({ lecId: 'x', ts: ahora - 10 * 24 * 3600e3, activa: false, y: 0.5 }, ahora, new Set())).toBeNull();
    expect(Mazo.decidirReanudar(null, ahora)).toBeNull();
  });
  it('minutos restantes', () => {
    expect(Mazo.minutosRestantes(10, 0.6)).toBe(4);
    expect(Mazo.minutosRestantes(10, 1)).toBe(1);
    expect(Mazo.minutosRestantes(8, -1)).toBe(8);
  });
});

describe('Mazo.extracto', () => {
  it('corta por frases sin pasarse', () => {
    const t = 'Primera frase. Segunda frase algo más larga. Tercera.';
    expect(Mazo.extracto(t, 30)).toBe('Primera frase.');
    expect(Mazo.extracto('corto', 30)).toBe('corto');
  });
});
