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
