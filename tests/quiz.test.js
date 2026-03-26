import { describe, it, expect } from 'vitest';
import { tcGetPool, buildTestQueue, responderLogic, calcResultados, difLabel } from '../lib/core.js';

/* ── Datos de prueba ── */
const libros = [
  { id: 'L1', titulo: 'Pensar rápido', autor: 'Kahneman', eje: 'Psicología' },
  { id: 'L2', titulo: 'Antifrágil', autor: 'Taleb', eje: 'Economía' },
  { id: 'L3', titulo: 'Sapiens', autor: 'Harari', eje: 'Historia' },
];

const preguntas = [
  { id: 'P1', libro_id: 'L1', texto: 'Pregunta 1', opciones: ['a','b','c','d'], correcta: 0, dificultad: 1 },
  { id: 'P2', libro_id: 'L1', texto: 'Pregunta 2', opciones: ['a','b','c','d'], correcta: 2, dificultad: 2 },
  { id: 'P3', libro_id: 'L2', texto: 'Pregunta 3', opciones: ['a','b','c','d'], correcta: 1, dificultad: 3 },
  { id: 'P4', libro_id: 'L2', texto: 'Pregunta 4', opciones: ['a','b','c','d'], correcta: 3, dificultad: 1 },
  { id: 'P5', libro_id: 'L3', texto: 'Pregunta 5', opciones: ['a','b','c','d'], correcta: 0, dificultad: 2 },
];

describe('tcGetPool — filtrado de preguntas', () => {

  it('devuelve todas las preguntas sin filtros', () => {
    const pool = tcGetPool(preguntas, libros, null, null);
    expect(pool).toHaveLength(5);
  });

  it('filtra por libro_id', () => {
    const pool = tcGetPool(preguntas, libros, 'L1', null);
    expect(pool).toHaveLength(2);
    expect(pool.every(p => p.libro_id === 'L1')).toBe(true);
  });

  it('filtra por eje', () => {
    const pool = tcGetPool(preguntas, libros, null, 'Economía');
    expect(pool).toHaveLength(2);
    expect(pool.map(p => p.id).sort()).toEqual(['P3', 'P4']);
  });

  it('filtra por libro + eje (el eje actúa sobre el libro)', () => {
    const pool = tcGetPool(preguntas, libros, 'L1', 'Psicología');
    expect(pool).toHaveLength(2);
  });

  it('devuelve vacío si el eje no coincide con el libro', () => {
    const pool = tcGetPool(preguntas, libros, 'L1', 'Economía');
    expect(pool).toHaveLength(0);
  });

  it('devuelve vacío con array de preguntas vacío', () => {
    expect(tcGetPool([], libros, null, null)).toHaveLength(0);
  });
});

describe('buildTestQueue — orden y límites', () => {

  const progConFallos = [
    { tipo: 'pregunta', item_id: 'P3', resultado: 'incorrecta' },
    { tipo: 'pregunta', item_id: 'P5', resultado: 'incorrecta' },
    { tipo: 'pregunta', item_id: 'P1', resultado: 'correcta' },
  ];

  it('prioriza preguntas falladas al inicio', () => {
    const queue = buildTestQueue(preguntas, progConFallos, 999);
    expect(queue[0].id).toBe('P3');
    expect(queue[1].id).toBe('P5');
  });

  it('limita a n preguntas', () => {
    const queue = buildTestQueue(preguntas, [], 3);
    expect(queue).toHaveLength(3);
  });

  it('n=999 devuelve todas', () => {
    const queue = buildTestQueue(preguntas, [], 999);
    expect(queue).toHaveLength(5);
  });

  it('n mayor que pool devuelve pool completo', () => {
    const queue = buildTestQueue(preguntas, [], 100);
    expect(queue).toHaveLength(5);
  });

  it('pool vacío devuelve array vacío', () => {
    expect(buildTestQueue([], [], 10)).toHaveLength(0);
  });

  it('sin progreso, todas son "resto" (no malas)', () => {
    const queue = buildTestQueue(preguntas, [], 5);
    expect(queue).toHaveLength(5);
  });
});

describe('responderLogic — verificación de respuesta', () => {

  const pregunta = { id: 'P1', correcta: 2, texto: 'Test', opciones: ['a','b','c','d'] };

  it('respuesta correcta', () => {
    const { ok, resultado } = responderLogic(pregunta, 2);
    expect(ok).toBe(true);
    expect(resultado).toBe('correcta');
  });

  it('respuesta incorrecta', () => {
    const { ok, resultado } = responderLogic(pregunta, 0);
    expect(ok).toBe(false);
    expect(resultado).toBe('incorrecta');
  });

  it('respuesta con índice fuera de rango devuelve null', () => {
    expect(responderLogic(pregunta, 5)).toBeNull();
  });

  it('respuesta con índice negativo devuelve null', () => {
    expect(responderLogic(pregunta, -1)).toBeNull();
  });

  it('pregunta sin opciones devuelve null para cualquier índice', () => {
    const sinOpciones = { id: 'PX', correcta: 0, texto: 'Rota' };
    expect(responderLogic(sinOpciones, 0)).toBeNull();
  });
});

describe('calcResultados — estadísticas finales', () => {

  it('test perfecto', () => {
    const resp = [{ ok: true }, { ok: true }, { ok: true }];
    const r = calcResultados(resp);
    expect(r.total).toBe(3);
    expect(r.ok).toBe(3);
    expect(r.pct).toBe(100);
    expect(r.fallos).toHaveLength(0);
  });

  it('test con fallos mixtos', () => {
    const resp = [{ ok: true }, { ok: false }, { ok: true }, { ok: false }];
    const r = calcResultados(resp);
    expect(r.total).toBe(4);
    expect(r.ok).toBe(2);
    expect(r.pct).toBe(50);
    expect(r.fallos).toHaveLength(2);
  });

  it('test todo incorrecto', () => {
    const resp = [{ ok: false }, { ok: false }];
    const r = calcResultados(resp);
    expect(r.pct).toBe(0);
    expect(r.fallos).toHaveLength(2);
  });

  it('test vacío (0 preguntas)', () => {
    const r = calcResultados([]);
    expect(r.total).toBe(0);
    expect(r.pct).toBe(0);
  });
});

describe('difLabel — etiqueta de dificultad', () => {

  it('dificultad 1 → Básica', () => {
    expect(difLabel(1)).toContain('Básica');
    expect(difLabel(1)).toContain('d1');
  });

  it('dificultad 2 → Media', () => {
    expect(difLabel(2)).toContain('Media');
    expect(difLabel(2)).toContain('d2');
  });

  it('dificultad 3 → Difícil', () => {
    expect(difLabel(3)).toContain('Difícil');
    expect(difLabel(3)).toContain('d3');
  });

  it('dificultad desconocida → Básica por defecto', () => {
    expect(difLabel(99)).toContain('Básica');
  });
});
