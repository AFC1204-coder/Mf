import { describe, it, expect } from 'vitest';
import I from '../tools/libros/idea-lint.js';

const lec = { cuerpo: 'Kahneman sostiene que el sistema rápido produce juicios automáticos basados en asociaciones, y que el sistema lento solo interviene cuando hay esfuerzo. En 1979 propuso la teoría prospectiva con Tversky.', autocorreccion: 'Algunos efectos no se han replicado bien.', aplicacion_practica: '', conexion_cruzada: '' };

describe('IdeaLint', () => {
  it('acepta una síntesis fiel', () => {
    const r = I.lint('El sistema rápido genera juicios automáticos por asociación, y el sistema lento solo interviene cuando exige esfuerzo.', lec);
    expect(r.errores).toEqual([]);
  });
  it('rechaza longitud, comillas y puntuación', () => {
    expect(I.lint('Corta.', lec).errores.join('|')).toMatch(/longitud/);
    expect(I.lint('El sistema rápido genera «juicios automáticos» por asociación y el lento interviene con esfuerzo.', lec).errores.join('|')).toMatch(/comillas/);
    expect(I.lint('El sistema rápido genera juicios automáticos por asociación y el lento interviene con esfuerzo', lec).errores.join('|')).toMatch(/punto/);
  });
  it('rechaza cifras que no están en la lección', () => {
    expect(I.lint('En 1985 se propuso la teoría prospectiva con Tversky para explicar los juicios.', lec).errores.join('|')).toMatch(/1985/);
    expect(I.lint('En 1979 se propuso la teoría prospectiva con Tversky para explicar los juicios.', lec).errores.join('|')).not.toMatch(/1979/);
  });
  it('rechaza ideas con temas que no están en la lección', () => {
    const r = I.lint('La dopamina regula la motivación mediante circuitos mesolímbicos del cerebro y el estriado ventral.', lec);
    expect(r.errores.join('|')).toMatch(/palabras con contenido/);
  });
  it('avisa de fórmulas de relleno y limita a dos frases', () => {
    expect(I.lint('La lección explica que el sistema rápido genera juicios automáticos por asociación.', lec).avisos.length).toBe(1);
    expect(I.lint('El sistema rápido genera juicios. El lento interviene con esfuerzo. Hay asociaciones automáticas siempre.', lec).errores.join('|')).toMatch(/dos frases/);
  });
});
