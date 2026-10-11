import { describe, it, expect } from 'vitest';
import Metricas from '../lib/metricas.js';

const ev = (dia, tipo, props, usuario_id) => ({ dia, tipo, props: props || {}, usuario_id: usuario_id || 'a' });

describe('Metricas.sesiones', () => {
  const e = [
    ev('2026-10-10', 'sesion_inicio'), ev('2026-10-10', 'sesion_cerrada', { segundos: 300 }),
    ev('2026-10-11', 'sesion_inicio'), ev('2026-10-11', 'sesion_abandonada', { paso: 'lee' }),
    ev('2026-10-12', 'sesion_inicio'), ev('2026-10-12', 'sesion_abandonada', { paso: 'lee' }),
    ev('2026-10-13', 'sesion_inicio'), ev('2026-10-13', 'sesion_cerrada', { segundos: 500 })
  ];
  it('cuenta empezadas, cerradas y abandonadas', () => {
    const s = Metricas.sesiones(e);
    expect(s).toMatchObject({ empezadas: 4, cerradas: 2, abandonadas: 2, finalizacion: 50 });
  });
  it('dice en qué paso se abandona y el tiempo mediano', () => {
    const s = Metricas.sesiones(e);
    expect(s.abandonoPorPaso).toEqual({ lee: 2 });
    expect(s.segundosMediana).toBe(400);
  });
  it('sin datos no inventa porcentajes', () => {
    expect(Metricas.sesiones([]).finalizacion).toBeNull();
    expect(Metricas.sesiones(null).empezadas).toBe(0);
  });
});

describe('Metricas.retencion', () => {
  const e = [
    ev('2026-09-01', 'tarjeta', {}, 'u1'), ev('2026-09-02', 'tarjeta', {}, 'u1'), ev('2026-09-08', 'sesion_cerrada', {}, 'u1'),
    ev('2026-09-01', 'tarjeta', {}, 'u2'),
    ev('2026-10-10', 'tarjeta', {}, 'u3')
  ];
  it('D1 y D7 miden solo a quien ya cumplió el plazo', () => {
    const r = Metricas.retencion(e, '2026-10-11');
    expect(r.d1).toMatchObject({ base: 3, vuelven: 1, pct: 33 });   // u3 ya cumplió el plazo de D1 y no volvió
    expect(r.d7).toMatchObject({ base: 2, vuelven: 1 });
  });
  it('no cuenta como retención lo que aún no puede medirse', () => {
    const r = Metricas.retencion([ev('2026-10-11', 'tarjeta')], '2026-10-11');
    expect(r.d1.base).toBe(0);
    expect(r.d1.pct).toBeNull();
  });
});

describe('Metricas.actividad y resumen', () => {
  const e = [
    ev('2026-10-09', 'leccion_leida'), ev('2026-10-10', 'sesion_cerrada'), ev('2026-10-10', 'tarjeta'),
    ev('2026-08-01', 'tarjeta')
  ];
  it('solo cuenta la ventana pedida', () => {
    const a = Metricas.actividad(e, '2026-10-11', 7);
    expect(a.usuarios).toBe(1);
    expect(a.diasConActividad).toBe(2);
    expect(a.diasActivosMax).toBe(2);
  });
  it('compromisos y comprobaciones', () => {
    const x = [ev('d', 'compromiso_respondido', { resultado: 'si' }), ev('d', 'compromiso_respondido', { resultado: 'no' }), ev('d', 'comprobacion', { ok: true }), ev('d', 'comprobacion', { ok: false })];
    expect(Metricas.compromisos(x)).toMatchObject({ si: 1, no: 1, total: 2, cumplidos: 50 });
    expect(Metricas.comprobacion(x)).toMatchObject({ total: 2, aciertos: 1, pct: 50 });
  });
  it('resumen devuelve una serie de la longitud pedida', () => {
    const r = Metricas.resumen(e, '2026-10-11', 14);
    expect(r.serie).toHaveLength(14);
    expect(r.serie[r.serie.length - 2]).toMatchObject({ dia: '2026-10-10', sesiones: 1, tarjetas: 1 });
  });
});
