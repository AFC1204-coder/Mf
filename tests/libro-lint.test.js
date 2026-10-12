import { describe, it, expect } from 'vitest';
import L from '../tools/libros/lint.js';

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

describe('LibroLint', () => {
  it('acepta un paquete bien formado', () => {
    const r = L.lint(base(), AUT);
    expect(r.errores).toEqual([]);
  });
  it('exige declarar y verificar las cifras', () => {
    const p = base(); p.lecciones[0].cuerpo += '\n\nEn 1998 el 85% de los casos fallaron.';
    expect(L.lint(p, AUT).errores.join('|')).toMatch(/cifra «1998»/);
    p.cifras = [{ valor: '1998', fuente: 'x', estado: 'verificada' }, { valor: '85%', fuente: 'x', estado: 'verificada' }];
    expect(L.lint(p, AUT).errores.filter(e => /cifra/.test(e))).toEqual([]);
    p.cifras[0].estado = 'dudosa';
    expect(L.lint(p, AUT).errores.join('|')).toMatch(/cifra «1998»/);
  });
  it('exige verificar las citas entrecomilladas largas', () => {
    const p = base(); p.lecciones[1].cuerpo += ' El autor escribe «una frase suficientemente larga para ser una cita literal del libro».';
    expect(L.lint(p, AUT).errores.join('|')).toMatch(/cita entrecomillada/);
    p.citas_literales = [{ texto: 'una frase suficientemente larga para ser una cita literal del libro', fuente: 'p. 3', verificada: true }];
    expect(L.lint(p, AUT).errores.filter(e => /cita/.test(e))).toEqual([]);
  });
  it('detecta la correcta más larga y las posiciones concentradas', () => {
    const p = base(); p.lecciones.forEach(l => l.preguntas.forEach(q => { q.correcta = 0; q.opciones[0] = q.opciones[0] + ' con una cola larguísima que delata la respuesta correcta frente al resto'; }));
    const e = L.lint(p, AUT).errores.join('|');
    expect(e).toMatch(/mide/);
    expect(e).toMatch(/se concentra en una posición/);
  });
  it('exige conexión con autores del corpus y eje válido', () => {
    const p = base(); p.libro.eje_principal = 'Otro'; p.lecciones[0].autores_relacionados = ['Nadie', 'Nunca']; p.lecciones[0].conexion_cruzada = 'x'.repeat(250);
    const e = L.lint(p, AUT).errores.join('|');
    expect(e).toMatch(/eje_principal/);
    expect(e).toMatch(/ningún autor relacionado/);
    expect(e).toMatch(/conexión cruzada no nombra/);
  });
  it('detecta preguntas repetidas y número de preguntas', () => {
    const p = base(); p.lecciones[0].preguntas = [p.lecciones[0].preguntas[0]];
    expect(L.lint(p, AUT).errores.join('|')).toMatch(/entre 2 y 4 preguntas/);
  });
});

import B from '../tools/libros/barajar.js';
describe('barajar paquete', () => {
  it('conserva la correcta y reparte las posiciones', () => {
    const p = base(); const antes = p.lecciones.flatMap(l => l.preguntas.map(q => q.opciones[q.correcta]));
    B.barajar(p);
    const despues = p.lecciones.flatMap(l => l.preguntas.map(q => q.opciones[q.correcta]));
    expect(despues).toEqual(antes);
    const pos = [0, 0, 0, 0]; p.lecciones.forEach(l => l.preguntas.forEach(q => pos[q.correcta]++));
    expect(Math.max(...pos) - Math.min(...pos)).toBeLessThanOrEqual(1);
    expect(L.lint(p, AUT).errores).toEqual([]);
  });
});
