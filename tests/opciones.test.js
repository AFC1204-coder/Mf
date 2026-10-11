import { describe, it, expect } from 'vitest';
import O from '../lib/opciones.js';

const azar = (s) => () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const q = { texto: 't', opciones: ['uno aaaa', 'dos bbbb', 'tres cccc', 'cuat dddd'], correcta: 0 };

describe('OpcionesQ · barajar', () => {
  it('conserva las mismas opciones y la correcta sigue apuntando a su texto', () => {
    for (let s = 1; s < 50; s++) {
      const b = O.barajarOpciones(q, azar(s));
      expect([...b.opciones].sort()).toEqual([...q.opciones].sort());
      expect(b.opciones[b.correcta]).toBe('uno aaaa');
    }
  });
  it('reparte la correcta entre las 4 posiciones', () => {
    const c = [0, 0, 0, 0];
    for (let s = 1; s <= 400; s++) c[O.barajarOpciones(q, azar(s)).correcta]++;
    c.forEach(n => expect(n).toBeGreaterThan(60));
  });
  it('no modifica el original', () => {
    O.barajarOpciones(q, azar(3));
    expect(q.opciones[0]).toBe('uno aaaa');
    expect(q.correcta).toBe(0);
  });
});

describe('OpcionesQ · revisión', () => {
  it('acepta opciones de longitud parecida', () => {
    expect(O.revisarPregunta(q)).toEqual([]);
  });
  it('detecta la correcta mucho más larga', () => {
    const p = { opciones: ['una respuesta larga y muy detallada que delata', 'corta uno', 'corta dos', 'corta tres'], correcta: 0 };
    expect(O.revisarPregunta(p).length).toBe(3);
  });
  it('detecta referencias a otras opciones y repetidas', () => {
    const p = { opciones: ['Todas las anteriores', 'Todas las anteriores', 'otra cosa aqui', 'otra más ahí'], correcta: 2 };
    const f = O.revisarPregunta(p).join('|');
    expect(f).toMatch(/remite/);
    expect(f).toMatch(/repetidas/);
  });
  it('rechaza formatos rotos', () => {
    expect(O.revisarPregunta({ opciones: ['a', 'b'], correcta: 0 })).toEqual(['no tiene 4 opciones']);
    expect(O.revisarPregunta({ opciones: ['a', 'b', 'c', 'd'], correcta: 7 })).toEqual(['índice de correcta no válido']);
  });
});
