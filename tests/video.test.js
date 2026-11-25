import { describe, it, expect } from 'vitest';
import V from '../lib/video.js';

const ID = 'dQw4w9WgXcQ', OTRO = 'abcdefghijk';
const indice = {
  v: 1,
  lecciones: {
    l1: { idea: { yt: ID, s: 118 }, fondo: { yt: OTRO, s: 290 }, pregunta: { yt: 'AAAAAAAAAAA', s: 30 } },
    l2: { fondo: { yt: OTRO, s: 45 } },
    mala: { idea: { yt: '"><script>', s: 60 } },
  },
  libros: { b1: { libro: { yt: ID, s: 44.7 } }, b2: { libro: { yt: ID, s: 40 }, recorrido: { yt: OTRO, s: 110 } } },
};

describe('vídeos de la lección', () => {
  it('ofrece la idea y la versión larga, en ese orden, y no las piezas de redes', () => {
    expect(V.deLeccion(indice, 'l1')).toEqual([
      { tipo: 'idea', etiqueta: 'Ver en vídeo', yt: ID, duracion: '2 min' },
      { tipo: 'fondo', etiqueta: 'Versión larga', yt: OTRO, duracion: '5 min' },
    ]);
  });
  it('una lección con solo la larga la ofrece', () => {
    expect(V.deLeccion(indice, 'l2').map(v => v.tipo)).toEqual(['fondo']);
    expect(V.deLeccion(indice, 'l2')[0].duracion).toBe('45 s');
  });
  it('sin índice, sin lección o sin vídeo: nada', () => {
    expect(V.deLeccion(null, 'l1')).toEqual([]);
    expect(V.deLeccion({}, 'l1')).toEqual([]);
    expect(V.deLeccion(indice, 'no-existe')).toEqual([]);
    expect(V.deLeccion(indice, undefined)).toEqual([]);
    expect(V.tiene(indice, 'l1')).toBe(true);
    expect(V.tiene(indice, 'no-existe')).toBe(false);
  });
  it('un identificador que no es de YouTube no se ofrece ni llega a una dirección', () => {
    expect(V.deLeccion(indice, 'mala')).toEqual([]);
    expect(V.urlIncrustar('"><script>')).toBe('');
    expect(V.urlMiniatura('corto')).toBe('');
    expect(V.urlVer(null)).toBe('');
  });
  it('el libro tiene su vídeo de presentación', () => {
    expect(V.deLibro(indice, 'b1')).toEqual([{ tipo: 'libro', etiqueta: 'El libro en vídeo', yt: ID, duracion: '45 s' }]);
    expect(V.deLibro(indice, 'l1')).toEqual([]);
    expect(V.deLibro(indice, 'b2').map(v => v.etiqueta)).toEqual(['El libro en vídeo', 'Idea a idea']);
  });
  it('direcciones: reproductor sin cookies, miniatura y enlace', () => {
    expect(V.urlIncrustar(ID)).toBe(`https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&playsinline=1&rel=0`);
    expect(V.urlMiniatura(ID)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
    expect(V.urlVer(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
  });
  it('duración dicha en palabras', () => {
    expect(V.duracion(0)).toBe('');
    expect(V.duracion('x')).toBe('');
    expect(V.duracion(59)).toBe('59 s');
    expect(V.duracion(60)).toBe('1 min');
    expect(V.duracion(200)).toBe('3 min');
  });
});
