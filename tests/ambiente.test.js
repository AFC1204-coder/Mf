import { describe, it, expect } from 'vitest';
import A from '../lib/ambiente.js';

const azar = (s) => () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rms = c => Math.sqrt(c.reduce((a, x) => a + x * x, 0) / c.length);
const pico = c => c.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

describe('Ambiente · preferencias', () => {
  it('solo acepta los tres sonidos y cae al neutro', () => {
    expect(A.SONIDOS.map(s => s.id)).toEqual(['marron', 'lluvia', 'sala']);
    expect(A.tipoValido('lluvia')).toBe('lluvia');
    expect(A.tipoValido('fuego')).toBe('marron');
    expect(A.tipoValido(null)).toBe('marron');
  });
  it('el volumen se acota y la curva es cuadrática', () => {
    expect(A.volumenValido(2)).toBe(1);
    expect(A.volumenValido(-1)).toBe(0);
    expect(A.volumenValido('x')).toBe(A.VOLUMEN_POR_DEFECTO);
    expect(A.curvaVolumen(0.5)).toBeCloseTo(0.25);
    expect(A.curvaVolumen(1)).toBe(1);
    expect(A.curvaVolumen(0)).toBe(0);
  });
});

describe('Ambiente · generadores', () => {
  const sr = 8000, n = sr * 3;
  it('ruido marrón: dos canales distintos, sin NaN y con el pico pedido', () => {
    const [L, R] = A.ruidoMarron(n, azar(1));
    expect(L.length).toBe(n);
    expect(L.some(Number.isNaN)).toBe(false);
    expect(Math.max(pico(L), pico(R))).toBeCloseTo(0.9, 2);
    expect(L).not.toEqual(R);
  });
  it('lluvia: sin NaN, pico controlado y con vida (no es silencio ni ruido plano)', () => {
    const [L, R] = A.ruidoLluvia(n, sr, azar(2));
    expect(L.some(Number.isNaN)).toBe(false);
    expect(Math.max(pico(L), pico(R))).toBeCloseTo(0.9, 2);
    expect(rms(L)).toBeGreaterThan(0.05);
    expect(pico(L) / rms(L)).toBeGreaterThan(3);      // las gotas sobresalen del siseo
    expect(L).not.toEqual(R);
  });
  it('es determinista con la misma semilla', () => {
    expect(A.ruidoLluvia(2000, sr, azar(7))[0]).toEqual(A.ruidoLluvia(2000, sr, azar(7))[0]);
  });
  it('empalmar acerca el final al principio (bucle sin clic)', () => {
    const [L] = A.ruidoMarron(n, azar(3));
    const antes = Math.abs(L[n - 1] - L[0]);
    A.empalmar([L], 400);
    expect(Math.abs(L[n - 1] - L[0])).toBeLessThanOrEqual(antes + 1e-6);
  });
  it('la sala no tiene nada por debajo de 140 Hz (se oiría poco en el móvil)', () => {
    expect(Math.min(...A.SALA.map(x => x.f))).toBeGreaterThanOrEqual(140);
  });
});
