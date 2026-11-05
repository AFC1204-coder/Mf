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
});
