import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const T = createRequire(import.meta.url)('../lib/tiempo.js');

describe('Tiempo · cuándo cuenta un segundo', () => {
  const base = { enLeccion: true, leccionId: 'L1', visible: true, ahora: 100000, ultimaInteraccion: 95000 };
  it('cuenta con la lección a la vista, pestaña visible e interacción reciente', () => { expect(T.cuenta(base)).toBe(true); });
  it('no cuenta si no hay lección en pantalla', () => {
    expect(T.cuenta({ ...base, enLeccion: false })).toBe(false);
    expect(T.cuenta({ ...base, leccionId: null })).toBe(false);
  });
  it('no cuenta con la pestaña en segundo plano', () => { expect(T.cuenta({ ...base, visible: false })).toBe(false); });
  it('no cuenta pasados 90 s sin interacción (móvil olvidado)', () => {
    expect(T.cuenta({ ...base, ultimaInteraccion: 100000 - 90000 })).toBe(true);
    expect(T.cuenta({ ...base, ultimaInteraccion: 100000 - 90001 })).toBe(false);
  });
  it('no cuenta sin ninguna interacción registrada ni con reloj incoherente', () => {
    expect(T.cuenta({ ...base, ultimaInteraccion: undefined })).toBe(false);
    expect(T.cuenta({ ...base, ultimaInteraccion: 100500 })).toBe(false);
    expect(T.cuenta(null)).toBe(false);
  });
});

describe('Tiempo · acumulación y guardado', () => {
  it('suma de segundo en segundo y respeta el tope diario', () => {
    const m = new Map();
    expect(T.sumar(m, 'L1', '2026-11-04')).toBe(true);
    expect(m.get('L1|2026-11-04')).toBe(1);
    m.set('L1|2026-11-04', T.MAX_DIA);
    expect(T.sumar(m, 'L1', '2026-11-04')).toBe(false);
  });
  it('días distintos son claves distintas', () => {
    const m = new Map(); T.sumar(m, 'L1', '2026-11-04'); T.sumar(m, 'L1', '2026-11-05');
    expect(m.size).toBe(2);
  });
  it('filas: solo las modificadas, con el total absoluto del día', () => {
    const m = new Map([['L1|2026-11-04', 125], ['L2|2026-11-04', 40]]);
    const f = T.filas(m, new Set(['L1|2026-11-04']), 'default');
    expect(f).toEqual([{ usuario_id: 'default', leccion_id: 'L1', dia: '2026-11-04', segundos: 125 }]);
    expect(T.filas(m, new Set(['L9|2026-11-04']), 'default')).toEqual([]);
  });
  it('deFilas recupera lo guardado y se queda con el mayor si hay repetidas', () => {
    const m = T.deFilas([{ leccion_id: 'L1', dia: '2026-11-04', segundos: 30 }, { leccion_id: 'L1', dia: '2026-11-04T00:00:00', segundos: 50 }, { leccion_id: null, dia: 'x' }]);
    expect(m.get('L1|2026-11-04')).toBe(50); expect(m.size).toBe(1);
  });
  it('texto legible', () => {
    expect(T.texto(0)).toBe('0 min'); expect(T.texto(45)).toBe('45 s'); expect(T.texto(600)).toBe('10 min');
    expect(T.texto(3900)).toBe('1 h 05 min'); expect(T.texto(7200)).toBe('2 h');
  });
});
