import { describe, it, expect } from 'vitest';
import Sesion from '../lib/sesion.js';

const t = n => Array.from({ length: n }, (_, i) => ({ repaso_id: 'r' + i }));
const lec = { id: 'l1' };

describe('Sesion.construir', () => {
  it('sesión completa: recuerda → lee → comprueba → lleva', () => {
    const s = Sesion.construir({ tarjetas: t(3), leccion: lec, pregunta: {}, tieneAccion: true, modo: 'corta', minCompleta: 4 });
    expect(s.pasos.map(p => p.k)).toEqual(['recuerda', 'lee', 'comprueba', 'lleva']);
    expect(s.pasos[0].n).toBe(3);
    expect(s.soloRecordar).toBe(false);
  });

  it('primer día, sin tarjetas: empieza por Lee', () => {
    const s = Sesion.construir({ tarjetas: [], leccion: lec, pregunta: null, tieneAccion: true, modo: 'corta', minCompleta: 3 });
    expect(s.pasos.map(p => p.k)).toEqual(['lee', 'lleva']);
  });

  it('máximo 3 tarjetas aunque haya más', () => {
    const s = Sesion.construir({ tarjetas: t(9), leccion: lec, modo: 'corta', minCompleta: 2 });
    expect(s.pasos[0].n).toBe(3);
  });

  it('el compromiso de ayer cuenta dentro de Recuerda', () => {
    const s = Sesion.construir({ tarjetas: t(2), compromiso: { id: 'c' }, leccion: lec, modo: 'corta', minCompleta: 2 });
    expect(s.pasos[0].n).toBe(3);
  });

  it('sin lección pero con tarjetas: solo recordar', () => {
    const s = Sesion.construir({ tarjetas: t(2), leccion: null });
    expect(s.soloRecordar).toBe(true);
    expect(s.pasos.map(p => p.k)).toEqual(['recuerda']);
  });

  it('nada que hacer: vacía', () => {
    expect(Sesion.construir({}).vacia).toBe(true);
  });

  it('lección sin acción ni pregunta: solo Lee', () => {
    const s = Sesion.construir({ leccion: lec, modo: 'completa', minCompleta: 5 });
    expect(s.pasos.map(p => p.k)).toEqual(['lee']);
    expect(s.pasos[0].min).toBe(5);
  });

  it('los minutos salen de lo que se hace de verdad', () => {
    const corta = Sesion.construir({ tarjetas: t(3), leccion: lec, pregunta: {}, tieneAccion: true, modo: 'corta', minCompleta: 4 });
    const larga = Sesion.construir({ tarjetas: t(3), leccion: lec, pregunta: {}, tieneAccion: true, modo: 'completa', minCompleta: 4 });
    expect(corta.minutos).toBeLessThan(larga.minutos);
    expect(corta.minutos).toBeGreaterThanOrEqual(1);
  });
});

describe('Sesion.minutosCorta', () => {
  it('entre 1 y 3', () => {
    expect(Sesion.minutosCorta(1)).toBe(1);
    expect(Sesion.minutosCorta(4)).toBe(2);
    expect(Sesion.minutosCorta(30)).toBe(3);
    expect(Sesion.minutosCorta(undefined)).toBe(1);
  });
});

describe('Sesion.diaCompromiso', () => {
  it('«hoy» se pregunta mañana', () => {
    expect(Sesion.diaCompromiso('hoy', '2026-10-10')).toBe('2026-10-11');
  });
  it('«esta semana» se pregunta en 4 días', () => {
    expect(Sesion.diaCompromiso('semana', '2026-10-29')).toBe('2026-11-02');
  });
});

describe('Sesion.textoAccion', () => {
  it('deja intacto lo corto', () => {
    expect(Sesion.textoAccion('Escribe qué te haría cambiar de opinión.')).toBe('Escribe qué te haría cambiar de opinión.');
  });
  it('quita markdown y HTML', () => {
    expect(Sesion.textoAccion('**Pide** <b>dos</b> estimaciones')).toBe('Pide dos estimaciones');
  });
  it('recorta en frase completa si puede', () => {
    const largo = 'Primera frase corta pero suficiente para ocupar bastante espacio dentro del texto. '.repeat(6);
    const r = Sesion.textoAccion(largo, 200);
    expect(r.length).toBeLessThanOrEqual(200);
    expect(r.endsWith('.')).toBe(true);
  });
});

describe('Sesion.resumen', () => {
  it('compone el resumen', () => {
    expect(Sesion.resumen({ recordadas: 3, leida: true, accion: true })).toBe('3 recordadas · 1 leída · 1 acción');
    expect(Sesion.resumen({ recordadas: 1 })).toBe('1 recordada');
    expect(Sesion.resumen({})).toBe('');
  });
});
