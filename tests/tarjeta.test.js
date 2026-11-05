import { describe, it, expect } from 'vitest';
import T from '../lib/tarjeta.js';

const medir = (t, fs) => t.length * fs * 0.5;           // ancho simulado: cada carácter mide medio tamaño de letra
const lec = (extra = {}) => Object.assign({ titulo: 'Los Cuatro Colores: ¿Cómo?', idea_clave: 'Una idea clave corta y clara que se recuerda bien.', autocorreccion: 'Este límite es real. Y hay otro más. Y un tercero que no debería caber siempre.' }, extra);

describe('Tarjeta · texto', () => {
  it('usa la idea clave tal cual, o la idea redactada, o el arranque del cuerpo', () => {
    expect(T.textoDeIdea(lec()).origen).toBe('idea_clave');
    expect(T.textoDeIdea(lec({ idea_clave: '', cita_memorable: 'Una idea redactada suficientemente larga.' })).origen).toBe('cita_memorable');
    const r = T.textoDeIdea({ cuerpo: 'Primera frase del cuerpo explicada con calma. Segunda frase.' });
    expect(r.origen).toBe('cuerpo');
    expect(T.textoDeIdea({}).texto).toBe('');
  });
  it('limpia marcas sin tocar las palabras', () => {
    expect(T.textoDeIdea(lec({ idea_clave: '**Una** idea <b>con</b> marcas y   espacios dobles.' })).texto).toBe('Una idea con marcas y espacios dobles.');
  });
  it('el extracto corta por frases enteras y, si no cabe ni una, por palabras con «…»', () => {
    expect(T.extracto('Primera frase. Segunda frase larga. Tercera.', 30)).toBe('Primera frase.');
    expect(T.extracto('Una sola frase muy larga que no cabe de ninguna manera en el espacio disponible', 30)).toMatch(/…$/);
    expect(T.extracto('corto', 30)).toBe('corto');
  });
  it('el matiz sale de la autocorrección y puede no haber', () => {
    expect(T.matiz(lec(), 24)).toBe('Este límite es real.');
    expect(T.matiz(lec(), 40)).toBe('Este límite es real. Y hay otro más.');
    expect(T.matiz({}, 40)).toBe('');
  });
});

describe('Tarjeta · envolver', () => {
  it('parte por palabras sin pasarse del ancho', () => {
    const r = T.envolver('uno dos tres cuatro cinco seis siete ocho', medir, 40, 400, 10);
    r.lineas.forEach(l => expect(medir(l, 40)).toBeLessThanOrEqual(400));
    expect(r.lineas.join(' ')).toBe('uno dos tres cuatro cinco seis siete ocho');
    expect(r.recortado).toBe(false);
  });
  it('si hay demasiadas líneas, quita frases del final y lo indica', () => {
    const t = 'Frase uno que ocupa bastante. Frase dos que ocupa bastante. Frase tres que ocupa bastante.';
    const r = T.envolver(t, medir, 40, 400, 3);
    expect(r.recortado).toBe(true);
    expect(r.lineas.length).toBeLessThanOrEqual(3);
    expect(t.startsWith(r.lineas.join(' '))).toBe(true);        // nunca reescribe: solo un prefijo de frases
  });
  it('una frase que no cabe se corta con «…» y nunca desborda', () => {
    const t = 'palabra '.repeat(60).trim();
    const r = T.envolver(t, medir, 40, 400, 2);
    expect(r.lineas.length).toBeLessThanOrEqual(2);
    expect(r.lineas[r.lineas.length - 1]).toMatch(/…$/);
  });
  it('una palabra más ancha que la línea no rompe nada', () => {
    const r = T.envolver('supercalifragilisticoespialidoso', medir, 40, 200, 3);
    expect(r.lineas.length).toBeGreaterThan(0);
  });
});

describe('Tarjeta · plan', () => {
  const altoTotal = p => p.altoIdea;
  it('la idea siempre cabe en la zona disponible, con o sin matiz y esquema', () => {
    const largo = 'Esta es una idea clave bastante más larga que la media porque explica un mecanismo con varios pasos y matices. '.repeat(4);
    for (const idea of ['Corta y clara con bastante texto para llenar una línea.', largo]) {
      for (const opc of [{}, { matiz: true }, { esquema: true }, { matiz: true, esquema: true }]) {
        const p = T.plan(lec({ idea_clave: idea }), opc, medir);
        expect(altoTotal(p)).toBeLessThanOrEqual(p.disponible + 1);
        p.idea.lineas.forEach(l => expect(medir(l, p.idea.fs)).toBeLessThanOrEqual(T.ANCHO + 0.5));
        p.matiz.lineas.forEach(l => expect(medir(l, p.matiz.fs)).toBeLessThanOrEqual(T.ANCHO + 0.5));
      }
    }
  });
  it('ideas cortas usan letra grande y las largas más pequeña', () => {
    const corta = T.plan(lec({ idea_clave: 'Una idea muy corta pero clara.' }), {}, medir);
    const larga = T.plan(lec({ idea_clave: 'Una idea larga. '.repeat(25) }), {}, medir);
    expect(corta.idea.fs).toBeGreaterThan(larga.idea.fs);
  });
  it('el texto de la tarjeta es un prefijo del original (no se reescribe)', () => {
    const idea = 'Primera frase con contenido. Segunda frase con más contenido. '.repeat(10).trim();
    const p = T.plan(lec({ idea_clave: idea }), { matiz: true, esquema: true }, medir);
    expect(idea.startsWith(p.idea.lineas.join(' ').replace(/…$/, ''))).toBe(true);
  });
  it('sin matiz en la lección no se reserva espacio', () => {
    const p = T.plan(lec({ autocorreccion: '' }), { matiz: true }, medir);
    expect(p.matiz.lineas).toEqual([]);
    expect(p.matiz.alto).toBe(0);
  });
  it('el nombre de archivo es seguro', () => {
    expect(T.nombreArchivo(lec())).toBe('idea-los-cuatro-colores-como.png');
    expect(T.nombreArchivo({})).toBe('idea-mente-fria.png');
  });
});
