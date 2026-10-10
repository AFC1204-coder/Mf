import { describe, it, expect } from 'vitest';
import Infografia from '../lib/infografia.js';

describe('Infografia.etiqueta', () => {
  it('deja intacto un título corto', () => {
    expect(Infografia.etiqueta('La trampa de la escasez')).toBe('La trampa de la escasez');
  });
  it('elige el tramo más largo que quepa entre «:» y « — »', () => {
    expect(Infografia.etiqueta('Limitaciones: Cuando TIT FOR TAT Falla')).toBe('Cuando TIT FOR TAT Falla');
    expect(Infografia.etiqueta('Recuperar lo Daimónico — Una Epistemología para el Siglo XXI')).toBe('Recuperar lo Daimónico');
  });
  it('recorta sin dejar una palabra floja al final', () => {
    const r = Infografia.etiqueta('Historia conjetural y evolución de las instituciones sin diseño previo', 5);
    expect(r.split(' ').length).toBeLessThanOrEqual(5);
    expect(/\b(de|la|el|y|en|del|las|los)$/i.test(r)).toBe(false);
  });
  it('quita paréntesis y espacios sobrantes', () => {
    expect(Infografia.etiqueta('  Regímenes laborales (atributos cedidos)  ')).toBe('Regímenes laborales');
  });
  it('vacío → vacío', () => {
    expect(Infografia.etiqueta('')).toBe('');
    expect(Infografia.etiqueta(null)).toBe('');
  });
});

describe('Infografia.repartir y conceptos', () => {
  it('reparte las lecciones a lo largo del libro, incluyendo la primera y la última', () => {
    const l = Array.from({ length: 20 }, (_, i) => i);
    const r = Infografia.repartir(l, 6);
    expect(r).toHaveLength(6);
    expect(r[0]).toBe(0);
    expect(r[5]).toBe(19);
  });
  it('si hay pocas, las usa todas', () => {
    expect(Infografia.repartir([1, 2, 3], 6)).toEqual([1, 2, 3]);
  });
  it('ordena por orden, evita etiquetas repetidas e ignora lecciones sin título', () => {
    const ls = [
      { titulo: 'Segunda idea', orden: 2 }, { titulo: 'Primera idea', orden: 1 },
      { titulo: 'primera idea', orden: 3 }, { titulo: '', orden: 4 }
    ];
    expect(Infografia.conceptos(ls, 6).map(c => c.etiqueta)).toEqual(['Primera idea', 'Segunda idea']);
  });
});

describe('Infografia.pie', () => {
  it('toma la primera frase y quita el punto', () => {
    expect(Infografia.pie('Cómo se decide bajo incertidumbre. Un libro clásico.')).toBe('Cómo se decide bajo incertidumbre');
  });
  it('recorta una frase larga en una palabra completa', () => {
    const r = Infografia.pie('Una frase larguísima que no acaba nunca y que sigue añadiendo palabras sin necesidad alguna para forzar el recorte final.', 60);
    expect(r.length).toBeLessThanOrEqual(60);
    expect(r.endsWith(' ')).toBe(false);
  });
  it('sin descripción → vacío', () => { expect(Infografia.pie('')).toBe(''); });
});

describe('Infografia.construirPrompt', () => {
  const libro = { titulo: 'Thinking in Bets', autor: 'Annie Duke', descripcion_breve: 'Decidir bien aunque el resultado sea incierto. Con ejemplos de póker.' };
  const lecs = ['Resultados y decisiones', 'Apuestas y creencias', 'Equipos de decisión', 'Mirar atrás sin sesgo', 'Futuros posibles', 'Pensar a largo plazo']
    .map((t, i) => ({ titulo: t, orden: i + 1 }));
  const r = Infografia.construirPrompt(libro, lecs);

  it('incluye título, autor y cada etiqueta numerada', () => {
    expect(r.prompt).toContain('«Thinking in Bets»');
    expect(r.prompt).toContain('Annie Duke');
    r.etiquetas.forEach((e, i) => expect(r.prompt).toContain(`${i + 1}. «${e}»`));
    expect(r.etiquetas).toHaveLength(6);
  });
  it('lleva las salvaguardas contra texto inventado y contenido prohibido', () => {
    expect(r.prompt).toMatch(/cópialo literalmente/);
    expect(r.prompt).toMatch(/nada de párrafos, citas, cifras, fechas ni nombres inventados/);
    expect(r.prompt).toMatch(/tildes y eñes correctas/);
    expect(r.prompt).toMatch(/sin reproducir la portada/);
    expect(r.prompt).toMatch(/14 px/);
  });
  it('usa la primera frase de la descripción como cierre', () => {
    expect(r.prompt).toContain('«Decidir bien aunque el resultado sea incierto»');
  });
  it('sin descripción, no inventa el cierre', () => {
    const s = Infografia.construirPrompt({ titulo: 'X', autor: 'Y' }, lecs);
    expect(s.prompt).toContain('cierre visual sencillo, sin texto');
  });
});

describe('Infografia.coste', () => {
  it('calcula con los precios oficiales', () => {
    expect(Infografia.coste(256, 'medium', 'gpt-image-1.5')).toBe(12.8);
    expect(Infografia.coste(10, 'high', 'gpt-image-1')).toBe(2.5);
  });
  it('null si el modelo o la calidad no se conocen', () => {
    expect(Infografia.coste(10, 'medium', 'otro-modelo')).toBeNull();
    expect(Infografia.coste(10, 'ultra', 'gpt-image-1')).toBeNull();
  });
});
