import { describe, it, expect } from 'vitest';
import L from '../tools/retos/lint.js';

const ok = (extra = {}) => Object.assign({ leccion_id: 'a'.repeat(8), tipo: 'vida_real', texto: '¿Dónde has visto esta semana a alguien cambiar de opinión sin que nadie le discutiera? ¿Qué lo provocó?', leccion_contraste_id: null, justificacion: 'La lección describe un mecanismo cotidiano que se detecta en conversaciones reales.' }, extra);

describe('retos · lint', () => {
  it('acepta un reto bien formado', () => { expect(L.revisar([ok()])).toEqual([]); });
  it('rechaza preguntas que se contestan copiando el texto', () => {
    for (const t of ['¿Qué dice el autor sobre la persuasión en el capítulo tres de esta lección?', '¿Cuál es la idea central de la lección y por qué importa en la práctica?', 'Según el autor, ¿por qué cambia la gente de opinión cuando le escuchan con atención?', 'Resume en tus palabras el mecanismo de la lección y qué consecuencias tiene para ti.'])
      expect(L.revisar([ok({ texto: t })]).join(' ')).toMatch(/copiando el texto/);
  });
  it('longitud entre 40 y 700 y una pregunta', () => {
    expect(L.revisar([ok({ texto: '¿Dónde?' })]).join()).toMatch(/caracteres/);
    expect(L.revisar([ok({ texto: 'x'.repeat(701) })]).join()).toMatch(/caracteres/);
    expect(L.revisar([ok({ texto: 'Piensa en algo que te haya pasado esta semana con esto, sin más.' })]).join()).toMatch(/pregunta/);
  });
  it('un reto por lección y tipos válidos', () => {
    expect(L.revisar([ok(), ok()]).join()).toMatch(/dos retos/);
    expect(L.revisar([ok({ tipo: 'quiz' })]).join()).toMatch(/tipo no válido/);
  });
  it('el choque necesita otra lección y solo él la lleva', () => {
    const c = ok({ tipo: 'choque', texto: '¿Qué le respondería Cialdini a esta idea? ¿Quién tiene más razón en la vida diaria y por qué?' });
    expect(L.revisar([c]).join()).toMatch(/leccion_contraste_id/);
    expect(L.revisar([{ ...c, leccion_contraste_id: c.leccion_id }]).join()).toMatch(/misma lección/);
    expect(L.revisar([{ ...c, leccion_contraste_id: 'b'.repeat(8) }])).toEqual([]);
    expect(L.revisar([ok({ leccion_contraste_id: 'b'.repeat(8) })]).join()).toMatch(/solo el «choque»/);
  });
  it('la predicción lleva plazo; la vida real, algo reciente; la otra cara, un argumento en contra; los primeros principios, un supuesto', () => {
    expect(L.revisar([ok({ tipo: 'predecir', texto: 'Si esta idea es cierta, ¿qué debería pasar con tu próxima conversación difícil?' })]).join()).toMatch(/plazo/);
    expect(L.revisar([ok({ tipo: 'predecir', texto: 'Si esta idea es cierta, ¿qué debería pasar con tu próxima conversación difícil en los próximos 30 días?' })]).join()).not.toMatch(/plazo/);
    expect(L.revisar([ok({ tipo: 'vida_real', texto: '¿Dónde has visto alguna vez este mecanismo funcionando en tu entorno de trabajo?' })]).join()).toMatch(/reciente/);
    expect(L.revisar([ok({ tipo: 'otra_cara', texto: '¿Qué opinas de esta idea y de cómo se aplica a tu día a día con otras personas?' })]).join()).toMatch(/en contra/);
    expect(L.revisar([ok({ tipo: 'primeros_principios', texto: '¿Qué opinas de esta idea y de cómo se aplica a tu día a día con otras personas?' })]).join()).toMatch(/supuesto/);
  });
  it('comprueba que las lecciones existan si se le pasan', () => {
    expect(L.revisar([ok()], { lecciones: new Set(['x']) }).join()).toMatch(/no existe/);
    expect(L.revisar([ok()], { lecciones: new Set([ok().leccion_id]) })).toEqual([]);
  });
  it('exige justificación', () => { expect(L.revisar([ok({ justificacion: '' })]).join()).toMatch(/justificación/); });
});
