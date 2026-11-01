import { describe, it, expect } from 'vitest';
import E from '../lib/estado.js';

describe('Estado · qué lado gana en cada campo', () => {
  it('sin nada en el servidor, sube todo lo que tenga marca', () => {
    const local = { ultima: { lecId: 'a', libId: 'x', ts: 50 }, ultimos: { ids: ['x'], ts: 60 }, hilo: { datos: null, ts: 0 } };
    expect(E.comparar(local, null)).toEqual({ bajar: [], subir: ['ultima', 'ultimos'] });
  });
  it('en un dispositivo nuevo (sin nada local) baja lo del servidor', () => {
    const remoto = { ultima: { lecId: 'a', libId: 'x', ts: 50 }, ultimos: { ids: ['x'], ts: 60 }, hilo: { datos: { frase: 'f' }, ts: 70 } };
    expect(E.comparar({}, remoto)).toEqual({ bajar: ['ultima', 'ultimos', 'hilo'], subir: [] });
  });
  it('cada campo se decide por separado: no se pisan', () => {
    const local = { ultima: { ts: 100 }, ultimos: { ts: 10 }, hilo: { ts: 5 } };
    const remoto = { ultima: { ts: 90 }, ultimos: { ts: 20 }, hilo: { ts: 5 } };
    expect(E.comparar(local, remoto)).toEqual({ bajar: ['ultimos'], subir: ['ultima'] });
  });
  it('con marcas iguales no hace nada', () => {
    const s = { ultima: { ts: 7 }, ultimos: { ts: 8 }, hilo: { ts: 9 } };
    expect(E.comparar(s, s)).toEqual({ bajar: [], subir: [] });
  });
  it('un hilo borrado (datos null) más reciente también baja', () => {
    expect(E.comparar({ hilo: { datos: { frase: 'f' }, ts: 10 } }, { hilo: { datos: null, ts: 20 } }).bajar).toEqual(['hilo']);
  });
  it('tolera filas incompletas o con marcas raras', () => {
    expect(E.comparar(undefined, undefined)).toEqual({ bajar: [], subir: [] });
    expect(E.comparar({ ultima: { ts: 'x' } }, { ultima: { ts: null } })).toEqual({ bajar: [], subir: [] });
    expect(E.ts({ ts: '123' })).toBe(123);
  });
});

describe('Estado · últimos libros', () => {
  it('el último leído pasa al principio y no se repite', () => {
    expect(E.empujarUltimo(['b', 'c', 'a'], 'a')).toEqual(['a', 'b', 'c']);
    expect(E.empujarUltimo([], 'a')).toEqual(['a']);
  });
  it('guarda como máximo seis', () => {
    const r = E.empujarUltimo(['1', '2', '3', '4', '5', '6'], '7');
    expect(r).toEqual(['7', '1', '2', '3', '4', '5']);
    expect(r).toHaveLength(E.MAX_ULTIMOS);
  });
  it('descarta lo que no sea un id de texto', () => {
    expect(E.normalizarUltimos(['a', 5, null, '', 'a', 'b', {}])).toEqual(['a', 'b']);
    expect(E.normalizarUltimos('no es lista')).toEqual([]);
    expect(E.empujarUltimo(undefined, 'z')).toEqual(['z']);
  });
});

describe('Estado · datos de antes de este sistema', () => {
  it('sin marca: 1 si hay dato (sube si el servidor está vacío, cede ante cambios reales), 0 si no', () => {
    expect(E.marcaInicial(true)).toBe(1);
    expect(E.marcaInicial(false)).toBe(0);
    const local = { ultimos: { ids: ['x'], ts: E.marcaInicial(true) } };
    expect(E.comparar(local, { ultimos: { ids: ['y'], ts: 1700000000000 } }).bajar).toEqual(['ultimos']);
    expect(E.comparar(local, {}).subir).toEqual(['ultimos']);
  });
});
