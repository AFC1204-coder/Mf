import { describe, it, expect } from 'vitest';
import L from '../lib/leida.js';

describe('LeidaAuto · tiempo necesario', () => {
  it('es una fracción del tiempo de lectura, con suelo y techo', () => {
    expect(L.segundosNecesarios(1)).toBe(25);               // 21 s → sube al mínimo
    expect(L.segundosNecesarios(5)).toBe(105);              // 5 min × 60 × 0,35
    expect(L.segundosNecesarios(12)).toBe(150);             // 252 s → tope
    expect(L.segundosNecesarios(60)).toBe(150);
  });
  it('tolera minutos ausentes o raros', () => {
    expect(L.segundosNecesarios(undefined)).toBe(25);
    expect(L.segundosNecesarios(0)).toBe(25);
    expect(L.segundosNecesarios('x')).toBe(25);
  });
});

describe('LeidaAuto · final del texto', () => {
  it('el final cuenta si el bloque más bajo queda dentro de la ventana (con margen)', () => {
    expect(L.finalAlcanzado([300, 780], 800)).toBe(true);
    expect(L.finalAlcanzado([300, 870], 800)).toBe(true);    // 80 px de margen
    expect(L.finalAlcanzado([300, 900], 800)).toBe(false);
  });
  it('se mira el bloque más bajo, no el primero', () => {
    expect(L.finalAlcanzado([100, 2500], 800)).toBe(false);
  });
  it('un texto que cabe entero en la pantalla ya está «al final»', () => {
    expect(L.finalAlcanzado([120, 400], 800)).toBe(true);
  });
  it('sin bloques o sin ventana no hay final', () => {
    expect(L.finalAlcanzado([], 800)).toBe(false);
    expect(L.finalAlcanzado(undefined, 800)).toBe(false);
    expect(L.finalAlcanzado([100], 0)).toBe(false);
    expect(L.finalAlcanzado([NaN], 800)).toBe(false);
  });
});

describe('LeidaAuto · decisión', () => {
  const base = { minutos: 5, altoVentana: 800 };
  it('hacen falta las dos cosas', () => {
    expect(L.haLeido({ ...base, segundos: 105, bottoms: [700] })).toBe(true);
    expect(L.haLeido({ ...base, segundos: 104, bottoms: [700] })).toBe(false);   // poco tiempo
    expect(L.haLeido({ ...base, segundos: 300, bottoms: [2000] })).toBe(false);  // sin llegar al final
  });
  it('deslizar de golpe hasta abajo no basta', () => {
    expect(L.haLeido({ ...base, segundos: 3, bottoms: [400] })).toBe(false);
  });
  it('entrada vacía no marca nada', () => {
    expect(L.haLeido()).toBe(false);
    expect(L.haLeido({})).toBe(false);
  });
});
