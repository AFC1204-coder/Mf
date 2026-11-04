import { describe, it, expect } from 'vitest';
import P from '../tools/libros/puerta.js';

const AUT = ['Daniel Kahneman', 'Nassim Nicholas Taleb', 'Friedrich A. Hayek'];
const parr = 'La idea central de este capítulo explica cómo funcionan los sistemas complejos cuando hay incentivos desalineados entre las partes. ';
const cuerpo = [parr.repeat(3), parr.repeat(3), parr.repeat(3)].join('\n\n');
const preg = (c, extra = {}) => ({
  texto: '¿Qué explica el capítulo ' + (extra.n || c) + ' sobre los sistemas complejos?', correcta: c, dificultad: 2,
  explicacion: 'El capítulo explica que los sistemas complejos fallan cuando los incentivos están desalineados entre las partes.',
  opciones: ['Que fallan cuando los incentivos están desalineados', 'Que siempre mejoran con más control central', 'Que dependen solo de factores aleatorios', 'Que solo ocurre en mercados financieros'].map((o, i, a) => a[(i + 4 - c) % 4]),
  ...extra
});
const lec = (n) => ({
  orden: n, titulo: 'Incentivos y sistemas complejos ' + n, cuerpo, idea_clave: 'Los sistemas complejos fallan cuando los incentivos no están alineados.',
  cita_memorable: 'Un sistema responde a lo que premia, no a lo que declara querer lograr.',
  conexion_cruzada: 'Taleb sostiene en sus trabajos que los sistemas con exposición asimétrica reaccionan de forma desproporcionada, y Kahneman documenta sesgos que agravan el problema cuando las decisiones se concentran en pocas personas con información parcial y presión de tiempo.',
  autocorreccion: 'El capítulo generaliza desde pocos casos y no distingue entre fallos de diseño y fallos de ejecución; conviene leerlo como hipótesis y buscar contraejemplos en sistemas que sí funcionan bien.',
  aplicacion_practica: 'Elige un proceso de tu trabajo y anota qué conducta premia realmente; después compara con lo que dices querer y ajusta una sola regla esta semana.',
  autores_relacionados: ['Taleb', 'Kahneman'], preguntas: [preg(n % 4, { n: 'uno-' + n }), preg((n + 1) % 4, { texto: '¿Cuál es otra consecuencia de los incentivos ' + n + '?' })]
});
const base = () => ({
  confianza: 'alta', cifras: [], citas_literales: [],
  libro: { autor: 'X', titulo: 'Y', año: 2001, eje_principal: 'Economía y Mercados', sub_eje: 'Incentivos', descripcion_breve: 'Un libro sobre incentivos, sistemas complejos y la forma en que las reglas moldean la conducta de las personas.' },
  lecciones: [1, 2, 3, 4].map(lec)
});


const informe = (ver, errores = 0) => ({ veredicto: ver, hallazgos: Array.from({ length: errores }, () => ({ severidad: 'ERROR' })).concat([{ severidad: 'DUDA' }]) });
const ctx = (o = {}) => Object.assign({ informes: [informe('publicar')], corpus: [{ titulo: 'Otro libro', autor: 'Z' }], autores: AUT, fase: 'cargar' }, o);

describe('Puerta de calidad', () => {
  it('un paquete bueno, verificado, pasa', () => {
    const r = P.evaluar(base(), ctx());
    expect(r.veredicto).toBe('publicar');
  });
  it('sin verificación independiente se rechaza', () => {
    expect(P.evaluar(base(), ctx({ informes: [] })).motivos.join('|')).toMatch(/falta la verificación/);
  });
  it('si el verificador rechaza, se rechaza', () => {
    expect(P.evaluar(base(), ctx({ informes: [informe('rechazar')] })).veredicto).toBe('rechazar');
  });
  it('un ERROR de contenido exige una segunda verificación limpia', () => {
    const solo = P.evaluar(base(), ctx({ informes: [informe('corregir', 1)] }));
    expect(solo.veredicto).toBe('rechazar');
    const dos = P.evaluar(base(), ctx({ informes: [informe('corregir', 1), informe('publicar', 0)] }));
    expect(dos.veredicto).toBe('publicar');
    const dosMal = P.evaluar(base(), ctx({ informes: [informe('corregir', 1), informe('corregir', 1)] }));
    expect(dosMal.veredicto).toBe('rechazar');
  });
  it('un fallo de forma (lint) se rechaza', () => {
    const p = base(); p.lecciones = p.lecciones.slice(0, 2);
    expect(P.evaluar(p, ctx()).veredicto).toBe('rechazar');
  });
  it('no duplica libros existentes', () => {
    const p = base(); p.libro.titulo = 'Los incentivos de los sistemas'; p.libro.autor = 'Ana Pérez';
    const r = P.evaluar(p, ctx({ corpus: [{ titulo: 'Los incentivos de los sistemas', autor: 'Ana Pérez' }] }));
    expect(r.motivos.join('|')).toMatch(/ya existe/);
    expect(P.esDuplicado({ titulo: 'Atomic Habits', autor: 'James Clear' }, [{ titulo: 'Hábitos Atómicos', autor: 'James Clear' }])).toBeNull();
    expect(P.esDuplicado({ titulo: 'Deep Work', autor: 'Cal Newport' }, [{ titulo: 'Deep Work: Rules for Focused Success', autor: 'Cal Newport' }])).toBeTruthy();
  });
  it('confianza baja o tema de riesgo pasan a revisión humana, nunca a publicar', () => {
    const baja = base(); baja.confianza = 'baja';
    expect(P.evaluar(baja, ctx()).veredicto).toBe('revisar');
    const salud = base(); salud.libro.titulo = 'Dieta cetogénica y cura del cáncer';
    const r = P.evaluar(salud, ctx());
    expect(r.veredicto).toBe('revisar');
    expect(r.motivos.join('|')).toMatch(/salud/);
  });
  it('tope semanal y avisos abiertos: hoy no toca', () => {
    expect(P.evaluar(base(), ctx({ publicadosSemana: 2 })).veredicto).toBe('esperar');
    expect(P.evaluar(base(), ctx({ reportesAbiertos: 6 })).veredicto).toBe('esperar');
    expect(P.evaluar(base(), ctx({ publicadosSemana: 1, reportesAbiertos: 5 })).veredicto).toBe('publicar');
  });
  it('para publicar hay que haber comprobado las huellas', () => {
    expect(P.evaluar(base(), ctx({ fase: 'publicar' })).veredicto).toBe('rechazar');
    expect(P.evaluar(base(), ctx({ fase: 'publicar', huellasOk: true })).veredicto).toBe('publicar');
  });
  it('exige aplicación práctica en todas las lecciones', () => {
    const p = base(); p.lecciones[1].aplicacion_practica = 'Pensar.';
    expect(P.evaluar(p, ctx()).veredicto).toBe('rechazar');
  });
});

describe('Elección de candidatos', () => {
  const corpus = [{ titulo: 'Existente', autor: 'A', sub_eje: 'Economía' }, { titulo: 'Otro', autor: 'B', sub_eje: 'Economía' }, { titulo: 'Tres', autor: 'C', sub_eje: 'Economía' }];
  const c = (titulo, o = {}) => Object.assign({ titulo, autor: 'X ' + titulo, estado: 'pendiente', prioridad: 50, sub_eje: 'Economía' }, o);
  it('elige el de más puntuación entre los pendientes', () => {
    const r = P.elegirCandidato([c('Uno', { prioridad: 40 }), c('Dos', { prioridad: 90 }), c('Tres libros', { prioridad: 60 })], corpus);
    expect(r.titulo).toBe('Dos');
  });
  it('un hueco poco poblado pesa más', () => {
    const hueco = c('Hueco', { prioridad: 50, sub_eje: 'Historia' }), lleno = c('Lleno', { prioridad: 50, sub_eje: 'Economía' });
    expect(P.puntuar(hueco, corpus)).toBeGreaterThan(P.puntuar(lleno, corpus));
  });
  it('ignora los que no están pendientes y los que ya existen', () => {
    const r = P.elegirCandidato([c('Existente', { autor: 'A', prioridad: 99 }), c('En curso', { estado: 'en_curso', prioridad: 99 }), c('Bueno', { prioridad: 30 })], corpus);
    expect(r.titulo).toBe('Bueno');
    expect(P.elegirCandidato([], corpus)).toBeNull();
  });
  it('los temas de riesgo bajan de puntuación', () => {
    expect(P.puntuar(c('Dieta y ayuno para curar el cáncer', { prioridad: 80 }), corpus)).toBeLessThan(P.puntuar(c('Sobre el conocimiento', { prioridad: 80 }), corpus));
  });
});
