import { describe, it, expect } from 'vitest';
import Swipe from '../lib/swipe.js';

const g = (o) => Object.assign({ dx: -120, dy: 10, ms: 250, x0: 200, ancho: 412, vista: 'home', ignorado: false }, o || {});

describe('Swipe.decidir', () => {
  it('izquierda lleva a la siguiente pantalla y derecha a la anterior', () => {
    expect(Swipe.decidir(g())).toEqual({ dir: 'sig', destino: 'biblioteca' });
    expect(Swipe.decidir(g({ vista: 'consulta', dx: 120 }))).toEqual({ dir: 'ant', destino: 'biblioteca' });
  });
  it('recorre el orden Hoy · Biblioteca · Consulta · Repaso · Tú', () => {
    let v = 'home'; const vistas = [v];
    for (let i = 0; i < 4; i++) { v = Swipe.decidir(g({ vista: v })).destino; vistas.push(v); }
    expect(vistas).toEqual(['home', 'biblioteca', 'consulta', 'repaso-srs', 'tu']);
  });
  it('en los extremos no hay a dónde ir', () => {
    expect(Swipe.decidir(g({ vista: 'home', dx: 120 }))).toBeNull();
    expect(Swipe.decidir(g({ vista: 'tu', dx: -120 }))).toBeNull();
  });
  it('un gesto corto, lento o más vertical que horizontal no cuenta', () => {
    expect(Swipe.decidir(g({ dx: -40 }))).toBeNull();
    expect(Swipe.decidir(g({ ms: 1500 }))).toBeNull();
    expect(Swipe.decidir(g({ dx: -100, dy: 90 }))).toBeNull();
    expect(Swipe.decidir(g({ dx: -100, dy: 60 }))).toBeNull();
    expect(Swipe.decidir(g({ dx: -100, dy: 50 }))).toEqual({ dir: 'sig', destino: 'biblioteca' });
  });
  it('los bordes de la pantalla se dejan al gesto «atrás» del sistema', () => {
    expect(Swipe.decidir(g({ x0: 10 }))).toBeNull();
    expect(Swipe.decidir(g({ x0: 405 }))).toBeNull();
  });
  it('solo funciona en las cinco pantallas principales y si el toque no está en algo que se desplaza', () => {
    expect(Swipe.decidir(g({ vista: 'leccion' }))).toBeNull();
    expect(Swipe.decidir(g({ vista: 'lecciones' }))).toBeNull();
    expect(Swipe.decidir(g({ ignorado: true }))).toBeNull();
  });
  it('entradas raras no rompen', () => {
    expect(Swipe.decidir(null)).toBeNull();
    expect(Swipe.decidir(g({ dx: NaN }))).toBeNull();
    expect(Swipe.vecino('xx', 'sig')).toBeNull();
  });
});
