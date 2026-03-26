import { describe, it, expect } from 'vitest';
import { calcStreak } from '../lib/core.js';

describe('calcStreak — cálculo de racha diaria', () => {

  it('devuelve 0 sin progreso', () => {
    expect(calcStreak([], '2026-03-26')).toBe(0);
  });

  it('racha de 1 día (hoy)', () => {
    const prog = [{ fecha: '2026-03-26T10:00:00Z' }];
    expect(calcStreak(prog, '2026-03-26')).toBe(1);
  });

  it('racha de 3 días consecutivos', () => {
    const prog = [
      { fecha: '2026-03-24T08:00:00Z' },
      { fecha: '2026-03-25T09:00:00Z' },
      { fecha: '2026-03-26T10:00:00Z' },
    ];
    expect(calcStreak(prog, '2026-03-26')).toBe(3);
  });

  it('racha se rompe si falta un día', () => {
    const prog = [
      { fecha: '2026-03-23T08:00:00Z' },
      { fecha: '2026-03-25T09:00:00Z' },
      { fecha: '2026-03-26T10:00:00Z' },
    ];
    expect(calcStreak(prog, '2026-03-26')).toBe(2);
  });

  it('racha 0 si el último día no es hoy', () => {
    const prog = [
      { fecha: '2026-03-20T08:00:00Z' },
      { fecha: '2026-03-21T09:00:00Z' },
    ];
    expect(calcStreak(prog, '2026-03-26')).toBe(0);
  });

  it('múltiples entradas en el mismo día cuentan como 1', () => {
    const prog = [
      { fecha: '2026-03-26T08:00:00Z' },
      { fecha: '2026-03-26T10:00:00Z' },
      { fecha: '2026-03-26T14:00:00Z' },
    ];
    expect(calcStreak(prog, '2026-03-26')).toBe(1);
  });

  it('ignora entradas con fecha null', () => {
    const prog = [
      { fecha: null },
      { fecha: '2026-03-26T10:00:00Z' },
    ];
    expect(calcStreak(prog, '2026-03-26')).toBe(1);
  });

  it('racha larga de 7 días', () => {
    const prog = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date('2026-03-26T12:00:00');
      d.setDate(d.getDate() - i);
      prog.push({ fecha: d.toISOString() });
    }
    expect(calcStreak(prog, '2026-03-26')).toBe(7);
  });

  it('usa fecha local, no UTC (actividad nocturna no salta al día siguiente)', () => {
    // 23:30 hora local del 26 de marzo — debe contar como día 26
    const prog = [
      { fecha: '2026-03-25T12:00:00' },
      { fecha: '2026-03-26T23:30:00' },
    ];
    expect(calcStreak(prog, '2026-03-26')).toBe(2);
  });
});
