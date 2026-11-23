import { describe, it, expect } from 'vitest';
import A from '../lib/audio.js';

describe('AudioLeccion', () => {
  it('metadatos: título, autor y libro, con valores por defecto', () => {
    const m = A.metadata({ titulo: '  Los   cuatro colores ' }, { titulo: 'Rodeado de idiotas', autor: 'Thomas Erikson' }, [{ src: 'i.png', sizes: '192x192' }]);
    expect(m).toEqual({ title: 'Los cuatro colores', artist: 'Thomas Erikson', album: 'Rodeado de idiotas', artwork: [{ src: 'i.png', sizes: '192x192', type: 'image/png' }] });
    expect(A.metadata(null, null)).toMatchObject({ title: 'Lección', artist: 'Mente fría', album: 'Mente fría', artwork: [] });
  });
  it('saltar no se sale del audio', () => {
    expect(A.saltar(10, 100, 15)).toBe(25);
    expect(A.saltar(95, 100, 15)).toBe(100);
    expect(A.saltar(5, 100, -15)).toBe(0);
    expect(A.saltar(5, NaN, 15)).toBe(20);
    expect(A.saltar('x', 100, 15)).toBe(0);
  });
  it('posición solo si hay duración', () => {
    expect(A.posicion(120, 30, 1)).toEqual({ duration: 120, position: 30, playbackRate: 1 });
    expect(A.posicion(120, 500, 1).position).toBe(120);
    expect(A.posicion(NaN, 3, 1)).toBeNull();
    expect(A.posicion(0, 0, 1)).toBeNull();
    expect(A.posicion(60, 1, 0).playbackRate).toBe(1);
  });
  it('el silencio es un WAV válido y silencioso', () => {
    const b = A.silencioWav(0.1);
    expect(String.fromCharCode(...b.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...b.slice(8, 12))).toBe('WAVE');
    expect(b.length).toBe(44 + 800);
    expect(new DataView(b.buffer).getUint32(40, true)).toBe(800);
    expect(b.slice(44).every(x => x === 128)).toBe(true);
  });
  describe('audio grabado', () => {
    const lec = { id: '149ffd37-1493-4b73-82af-5eec8cfdcfef', titulo: 'Señal — antojo', cuerpo: 'Uno.\n\nDos «tres» 😀.', autocorreccion: 'Pero no siempre.' };
    it('la huella es la misma cuenta que hace tools/audio (FNV-1a sobre UTF-16)', () => {
      expect(A.huella(lec)).toBe('f5bf28c3');
      expect(A.huella({})).toBe(A.huella({ titulo: '', cuerpo: null }));
      expect(A.huella({ ...lec, cuerpo: lec.cuerpo + ' ' })).not.toBe(A.huella(lec));
    });
    it('solo vale si el texto no ha cambiado desde que se grabó', () => {
      const idx = { v: 1, base: 'audio/', lecciones: { [lec.id]: { s: 181, h: A.huella(lec), r: 'ab12cd' } } };
      expect(A.grabado(idx, lec)).toEqual({ url: `audio/${lec.id}.mp3`, clave: `${lec.id}-g-${A.huella(lec)}-ab12cd`, s: 181 });
      expect(A.tieneGrabado(idx, lec)).toBe(true);
      expect(A.grabado(idx, { ...lec, autocorreccion: 'Otro matiz.' })).toBeNull();
      expect(A.grabado(idx, { ...lec, id: 'otra' })).toBeNull();
      expect(A.grabado(null, lec)).toBeNull();
      expect(A.grabado({ lecciones: {} }, lec)).toBeNull();
    });
    it('una base rara del índice no llega a la dirección', () => {
      const e = { s: 10, h: A.huella(lec), r: 'ab12cd' };
      for (const base of ['https://otro.sitio/', '//otro.sitio/', '../', 'javascript:', 7]) {
        expect(A.grabado({ base, lecciones: { [lec.id]: e } }, lec).url).toBe(`audio/${lec.id}.mp3`);
      }
      expect(A.grabado({ base: 'medios/audio/', lecciones: { [lec.id]: e } }, lec).url).toBe(`medios/audio/${lec.id}.mp3`);
    });
  });
});
