import { describe, it, expect } from 'vitest';
import Visuales from '../lib/visuales.js';
import Diagrama from '../lib/diagram.js';
import Mapa from '../lib/mapa.js';

const spec = (t = 'Idea') => ({ tipo: 'diagrama', plantilla: 'pasos', titulo: t, datos: { pasos: [{ t: 'Uno' }, { t: 'Dos' }] } });

describe('Visuales.fusionarDiagramas', () => {
  it('añade el diagrama del archivo a las lecciones que no tienen ninguno', () => {
    const lecs = [{ id: 'a' }, { id: 'b', imagenes_inline: null }];
    const n = Visuales.fusionarDiagramas(lecs, { a: [spec()], b: [spec('B')] }, Diagrama);
    expect(n).toBe(2);
    expect(Diagrama.deLeccion(lecs[0])).toHaveLength(1);
    expect(lecs[1].imagenes_inline[0].titulo).toBe('B');
    expect(lecs[0].diagrama_de_archivo).toBe(true);
  });
  it('NO pisa el diagrama que ya viene de la base de datos', () => {
    const propio = spec('De la base de datos');
    const lecs = [{ id: 'a', imagenes_inline: [propio] }];
    expect(Visuales.fusionarDiagramas(lecs, { a: [spec('Del archivo')] }, Diagrama)).toBe(0);
    expect(lecs[0].imagenes_inline[0].titulo).toBe('De la base de datos');
  });
  it('ignora especificaciones inválidas y lecciones sin entrada', () => {
    const lecs = [{ id: 'a' }, { id: 'b' }];
    const n = Visuales.fusionarDiagramas(lecs, { a: [{ tipo: 'diagrama', plantilla: 'no-existe', datos: {} }] }, Diagrama);
    expect(n).toBe(0);
    expect(lecs[0].imagenes_inline).toBeUndefined();
  });
  it('tolera datos nulos, mal formados o listas vacías', () => {
    expect(Visuales.fusionarDiagramas([{ id: 'a' }], null, Diagrama)).toBe(0);
    expect(Visuales.fusionarDiagramas([{ id: 'a' }], { a: [] }, Diagrama)).toBe(0);
    expect(Visuales.fusionarDiagramas(null, {}, Diagrama)).toBe(0);
  });
});

describe('Visuales.fusionarMapas', () => {
  const mapa = () => ({ titulo: 'T', nodos: [{ etiqueta: 'a', icono: 'dado' }, { etiqueta: 'b', icono: 'ojo' }, { etiqueta: 'c', icono: 'red' }] });
  it('asigna el mapa válido a su libro', () => {
    const libros = [{ id: 'x' }, { id: 'y' }];
    expect(Visuales.fusionarMapas(libros, { x: mapa() }, Mapa)).toBe(1);
    expect(libros[0].mapa.titulo).toBe('T');
    expect(libros[1].mapa).toBeUndefined();
  });
  it('descarta mapas inválidos', () => {
    const libros = [{ id: 'x' }];
    expect(Visuales.fusionarMapas(libros, { x: { titulo: 'T', nodos: [] } }, Mapa)).toBe(0);
    expect(libros[0].mapa).toBeUndefined();
  });
});

describe('Visuales.colocarFiguras', () => {
  const P = n => Array.from({ length: n }, (_, i) => 'Párrafo corrido número ' + i + '.');
  it('una figura va tras el primer párrafo', () => {
    expect(Visuales.colocarFiguras(P(5), 1)).toEqual([0]);
  });
  it('las demás se reparten por el texto, sin apilarse y sin cerrar la lección', () => {
    const r = Visuales.colocarFiguras(P(8), 3);
    expect(r).toHaveLength(3);
    expect(r[0]).toBe(0);
    expect(new Set(r).size).toBe(3);
    expect(r).toEqual([...r].sort((a, b) => a - b));
    expect(Math.max(...r)).toBeLessThan(7);              // nunca tras el último párrafo
    expect(r[1] - r[0]).toBeGreaterThan(1);               // separadas
  });
  it('solo se coloca tras párrafos corridos, no dentro de listas ni tablas', () => {
    const partes = ['Intro.', '- uno\n- dos', 'Un párrafo normal.', '1. paso\n2. paso', 'Otro párrafo.', '| a | b |\n|---|---|', 'Cierre.'];
    const r = Visuales.colocarFiguras(partes, 3);
    r.forEach(i => expect(Visuales.esParrafo(partes[i])).toBe(true));
  });
  it('si el texto empieza por una lista o es de un solo bloque, no hay sitio (que se muestren al principio)', () => {
    expect(Visuales.colocarFiguras(['- a\n- b', 'Texto.'], 1)).toEqual([]);
    expect(Visuales.colocarFiguras(['Un solo bloque.'], 1)).toEqual([]);
    expect(Visuales.colocarFiguras([], 2)).toEqual([]);
    expect(Visuales.colocarFiguras(P(4), 0)).toEqual([]);
  });
  it('con pocos párrafos devuelve menos sitios que figuras', () => {
    expect(Visuales.colocarFiguras(P(2), 3)).toEqual([0]);
  });
});

describe('Visuales.fusionarDiagramas — figuras adicionales', () => {
  const Diagrama = { valido: s => !!(s && s.tipo === 'diagrama'), deLeccion: l => (Array.isArray(l.imagenes_inline) ? l.imagenes_inline : []).filter(s => s && s.tipo === 'diagrama') };
  const d = (t, extra) => Object.assign({ tipo: 'diagrama', plantilla: 'x', titulo: t, datos: {} }, extra || {});
  it('una lección con diagrama en la base de datos recibe solo las figuras «adicional» del archivo', () => {
    const lecs = [{ id: 'A', imagenes_inline: [d('bd')] }];
    const n = Visuales.fusionarDiagramas(lecs, { A: [d('archivo'), d('mates', { adicional: true })] }, Diagrama);
    expect(n).toBe(1);
    expect(lecs[0].imagenes_inline.map(s => s.titulo)).toEqual(['bd', 'mates']);
  });
  it('sin «adicional» la lección con diagrama propio no cambia (como antes)', () => {
    const lecs = [{ id: 'A', imagenes_inline: [d('bd')] }];
    expect(Visuales.fusionarDiagramas(lecs, { A: [d('archivo')] }, Diagrama)).toBe(0);
    expect(lecs[0].imagenes_inline.map(s => s.titulo)).toEqual(['bd']);
  });
  it('una lección sin diagrama propio recibe todas las del archivo', () => {
    const lecs = [{ id: 'A', imagenes_inline: null }];
    Visuales.fusionarDiagramas(lecs, { A: [d('archivo'), d('mates', { adicional: true })] }, Diagrama);
    expect(lecs[0].imagenes_inline.map(s => s.titulo)).toEqual(['archivo', 'mates']);
  });
  it('acepta imagenes_inline de la base de datos guardado como texto JSON o como objeto suelto', () => {
    const a = [{ id: 'A', imagenes_inline: JSON.stringify([d('bd')]) }];
    const b = [{ id: 'B', imagenes_inline: d('suelto') }];
    const Dg = { valido: s => !!(s && s.tipo === 'diagrama'), deLeccion: () => [d('x')] };
    Visuales.fusionarDiagramas(a, { A: [d('m', { adicional: true })] }, Dg);
    Visuales.fusionarDiagramas(b, { B: [d('m', { adicional: true })] }, Dg);
    expect(a[0].imagenes_inline.map(s => s.titulo)).toEqual(['bd', 'm']);
    expect(b[0].imagenes_inline.map(s => s.titulo)).toEqual(['suelto', 'm']);
  });
});
