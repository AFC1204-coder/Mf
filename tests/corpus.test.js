import { describe, it, expect } from 'vitest';
import Corpus from '../lib/corpus.js';

describe('Corpus · paginación', () => {
  it('lee el total de Content-Range', () => {
    expect(Corpus.totalDeRango('0-999/2120')).toBe(2120);
    expect(Corpus.totalDeRango('*/0')).toBe(0);
    expect(Corpus.totalDeRango('0-999/*')).toBeNull();
    expect(Corpus.totalDeRango(null)).toBeNull();
  });
  it('calcula las páginas que faltan', () => {
    expect(Corpus.desplazamientos(2120, 1000)).toEqual([1000, 2000]);
    expect(Corpus.desplazamientos(1000, 1000)).toEqual([]);
    expect(Corpus.desplazamientos(0, 1000)).toEqual([]);
  });
});

describe('Corpus · columnas', () => {
  it('no descarga el índice de búsqueda ni los SVG antiguos', () => {
    const cols = Corpus.COLUMNAS_LECCION.split(',');
    expect(cols).not.toContain('busqueda');
    expect(cols).not.toContain('imagen_principal');
    expect(cols).toEqual(expect.arrayContaining(['id', 'libro_id', 'cuerpo', 'idea_clave', 'conexion_cruzada', 'imagenes_inline']));
  });
});

describe('Corpus.fusionarImagenes', () => {
  it('pone las URL y marca los SVG pendientes', () => {
    const lecs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    Corpus.fusionarImagenes(lecs, [{ id: 'a', imagen_principal: 'https://x/y.png' }], [{ id: 'b' }]);
    expect(lecs[0].imagen_principal).toBe('https://x/y.png');
    expect(lecs[1]._svgPendiente).toBe(true);
    expect(lecs[2]).toEqual({ id: 'c' });
  });
});

describe('Corpus · caducidad y huella', () => {
  const c = { v: Corpus.VERSION, ts: 1000, libros: [{}], lecs: [{}] };
  it('utilizable solo con la versión actual y datos', () => {
    expect(Corpus.utilizable(c)).toBe(true);
    expect(Corpus.utilizable({ ...c, v: 0 })).toBe(false);
    expect(Corpus.utilizable({ ...c, lecs: [] })).toBe(false);
    expect(Corpus.utilizable(null)).toBe(false);
  });
  it('caduca pasado el plazo', () => {
    expect(Corpus.caducado(c, 1000 + Corpus.CADUCIDAD_MS - 1)).toBe(false);
    expect(Corpus.caducado(c, 1000 + Corpus.CADUCIDAD_MS + 1)).toBe(true);
    expect(Corpus.caducado(null, 0)).toBe(true);
  });
  it('la huella cambia si cambia el progreso', () => {
    const a = { libros: [1], lecs: [1, 2], preg: [], prog: [{ id: 1 }], revisiones: [] };
    const b = { ...a, prog: [{ id: 1 }, { id: 2 }] };
    expect(Corpus.huella(a)).not.toBe(Corpus.huella(b));
    expect(Corpus.huella(a)).toBe(Corpus.huella({ ...a }));
  });
});
