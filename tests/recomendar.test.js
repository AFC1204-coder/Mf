import { describe, it, expect } from 'vitest';
import Recomendar from '../lib/recomendar.js';

const B = (id, eje, extra) => Object.assign({ id, titulo: 'Libro ' + id, autor: 'A' + id, eje_principal: eje, portada_url: 'x' + id }, extra || {});
const libros = [B('a', 'Mente'), B('b', 'Mente'), B('c', 'Mente'), B('d', 'Economía'), B('e', 'Economía'), B('f', 'Mente')];
const L = (id, libro) => ({ id, libro_id: libro });
const lecs = [L('a1', 'a'), L('a2', 'a'), L('a3', 'a'), L('b1', 'b'), L('c1', 'c'), L('d1', 'd'), L('e1', 'e'), L('f1', 'f')];
const rel = (libro) => (libro.id === 'a' ? [libros[1], libros[2]] : []);

describe('Recomendar.recomendar', () => {
  it('abre con el libro a medias, luego afines, y dice por qué', () => {
    const r = Recomendar.recomendar({ libros, lecs, leidas: ['a1'], relacionados: rel, esNuevo: b => b.id === 'e' });
    expect(r[0]).toMatchObject({ tipo: 'sigue', progreso: '1 de 3' });
    expect(r[0].libro.id).toBe('a');
    const afin = r.find(x => x.tipo === 'afin');
    expect(afin.motivo).toContain('Libro a');
    expect(r.find(x => x.tipo === 'nuevo').libro.id).toBe('e');
  });
  it('no repite libros ni recomienda libros ya empezados como afines', () => {
    const r = Recomendar.recomendar({ libros, lecs, leidas: ['a1', 'b1'], relacionados: rel });
    const ids = r.map(x => x.libro.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(r.filter(x => x.tipo === 'afin').every(x => x.libro.id !== 'b')).toBe(true);
  });
  it('un libro terminado no sale como «sigue aquí»', () => {
    const r = Recomendar.recomendar({ libros, lecs, leidas: ['b1'] });
    expect(r.find(x => x.tipo === 'sigue')).toBeUndefined();
    expect(r.find(x => x.libro.id === 'b')).toBeUndefined();
  });
  it('sin historial ofrece libros con portada para empezar', () => {
    const r = Recomendar.recomendar({ libros, lecs, leidas: [] });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every(x => x.tipo === 'empezar')).toBe(true);
  });
  it('respeta el máximo y no incluye libros sin lecciones', () => {
    const muchos = Array.from({ length: 20 }, (_, i) => B('z' + i, 'Mente'));
    const ls = muchos.map((b, i) => L('l' + i, b.id));
    const r = Recomendar.recomendar({ libros: muchos.concat([B('vacio', 'Mente')]), lecs: ls, leidas: [], n: 5 });
    expect(r.length).toBe(5);
    expect(r.find(x => x.libro.id === 'vacio')).toBeUndefined();
  });
  it('más de tu tema favorito cuando hay historial en un eje', () => {
    const r = Recomendar.recomendar({ libros, lecs, leidas: ['d1'] });
    expect(r.some(x => x.tipo === 'tema' && x.motivo.includes('Economía'))).toBe(true);
  });
  it('entradas vacías no rompen', () => {
    expect(Recomendar.recomendar({})).toEqual([]);
    expect(Recomendar.recomendar({ libros: [], lecs: [], leidas: ['zz'] })).toEqual([]);
  });
});
