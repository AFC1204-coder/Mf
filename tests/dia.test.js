import { describe, it, expect } from 'vitest';
import Dia from '../lib/dia.js';

// Fechas locales sin zona: new Date('YYYY-MM-DDTHH:mm') se interpreta en hora local.
describe('Dia.logico — corte a las 04:00', () => {
  it('las 00:30 pertenecen a la noche anterior', () => {
    expect(Dia.logico(new Date('2026-10-11T00:30'))).toBe('2026-10-10');
  });
  it('las 03:59 todavía son la noche anterior', () => {
    expect(Dia.logico(new Date('2026-10-11T03:59'))).toBe('2026-10-10');
  });
  it('las 04:00 empiezan el día nuevo', () => {
    expect(Dia.logico(new Date('2026-10-11T04:00'))).toBe('2026-10-11');
  });
  it('cruza mes y año', () => {
    expect(Dia.logico(new Date('2027-01-01T01:00'))).toBe('2026-12-31');
  });
  it('corte configurable (0 = medianoche)', () => {
    expect(Dia.logico(new Date('2026-10-11T00:30'), 0)).toBe('2026-10-11');
  });
  it('fecha inválida → null', () => {
    expect(Dia.logico('nada')).toBeNull();
  });
});

describe('Dia.racha', () => {
  const f = s => new Date(s).toISOString();

  it('0 sin actividad', () => {
    expect(Dia.racha([], '2026-10-10')).toBe(0);
  });
  it('lectura nocturna seguida cuenta como días consecutivos', () => {
    const fechas = [f('2026-10-08T23:30'), f('2026-10-10T00:40'), f('2026-10-10T23:50')];
    // 8 (23:30) · 9 (00:40 del 10) · 10 (23:50)
    expect(Dia.racha(fechas, '2026-10-10')).toBe(3);
  });
  it('hoy sin actividad no rompe la racha de ayer', () => {
    const fechas = [f('2026-10-08T22:00'), f('2026-10-09T22:00')];
    expect(Dia.racha(fechas, '2026-10-10')).toBe(2);
  });
  it('un hueco de dos días la corta', () => {
    const fechas = [f('2026-10-07T22:00')];
    expect(Dia.racha(fechas, '2026-10-10')).toBe(0);
  });
  it('mezcla lecturas y repasos sin duplicar días', () => {
    const fechas = [f('2026-10-10T12:00'), f('2026-10-10T22:00'), f('2026-10-11T01:00')];
    expect(Dia.racha(fechas, '2026-10-10')).toBe(1);
  });
});

describe('Dia.diasDelMes', () => {
  it('cuenta días lógicos del mes en curso', () => {
    const fechas = ['2026-10-01T02:00', '2026-10-02T20:00', '2026-10-02T23:00', '2026-10-05T10:00']
      .map(s => new Date(s).toISOString());
    // 1 oct 02:00 → 30 sep (fuera del mes)
    expect(Dia.diasDelMes(fechas, '2026-10-10')).toBe(2);
  });
});
