import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import Mapa from '../lib/mapa.js';

const spec = () => ({
  titulo: 'Thinking in Bets', autor: 'Annie Duke', eje: 'Psicología y Conducta', subeje: 'Cognitiva',
  nodos: [
    { etiqueta: 'Resulting', texto: 'Juzgar una decisión por su resultado es un error', icono: 'dado' },
    { etiqueta: 'Suerte y habilidad', texto: 'El problema de la atribución', icono: 'balanza' },
    { etiqueta: 'Creencias como apuestas', texto: 'Toda opinión tiene un grado de confianza', icono: 'diana' }
  ],
  cierre: 'Separar la calidad de la decisión de la calidad del resultado.'
});

describe('Mapa.validar', () => {
  it('acepta una especificación correcta', () => { expect(Mapa.validar(spec())).toEqual([]); });
  it('exige entre 3 y 6 nodos', () => {
    const s = spec(); s.nodos = s.nodos.slice(0, 2);
    expect(Mapa.validar(s).join()).toMatch(/entre 3 y 6/);
    const t = spec(); t.nodos = Array.from({ length: 7 }, () => ({ etiqueta: 'a', icono: 'dado' }));
    expect(Mapa.validar(t).join()).toMatch(/entre 3 y 6/);
  });
  it('limita etiquetas, textos y cierre', () => {
    const s = spec();
    s.nodos[0].etiqueta = 'una dos tres cuatro cinco seis';
    s.nodos[1].texto = 'uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece';
    s.cierre = Array(25).fill('palabra').join(' ');
    const e = Mapa.validar(s).join(' | ');
    expect(e).toMatch(/Nodo 1: la etiqueta pasa de 5/);
    expect(e).toMatch(/Nodo 2: el texto pasa de 12/);
    expect(e).toMatch(/cierre pasa de 22/);
  });
  it('rechaza iconos que no existen y títulos vacíos', () => {
    const s = spec(); s.nodos[0].icono = 'unicornio'; s.titulo = ' ';
    const e = Mapa.validar(s).join(' | ');
    expect(e).toMatch(/icono desconocido/);
    expect(e).toMatch(/Falta el título/);
  });
});

describe('Mapa.envolver', () => {
  it('no corta palabras y respeta el máximo', () => {
    const l = Mapa.envolver('Juzgar una decisión por su resultado es un error', 20);
    l.forEach(x => expect(x.length).toBeLessThanOrEqual(20));
    expect(l.join(' ')).toBe('Juzgar una decisión por su resultado es un error');
  });
  it('una palabra más larga que el máximo queda entera en su línea', () => {
    expect(Mapa.envolver('anticonstitucionalmente bien', 10)).toEqual(['anticonstitucionalmente', 'bien']);
  });
});

describe('Mapa.svg', () => {
  const s = Mapa.svg(spec());
  const doc = new JSDOM(s, { contentType: 'image/svg+xml' }).window.document;

  it('es XML bien formado con viewBox y descripción accesible', () => {
    expect(doc.documentElement.nodeName).toBe('svg');
    expect(doc.documentElement.getAttribute('viewBox')).toMatch(/^0 0 640 \d+$/);
    expect(doc.documentElement.getAttribute('role')).toBe('img');
    expect(doc.documentElement.getAttribute('aria-label')).toContain('Thinking in Bets');
  });
  it('contiene exactamente los textos de la especificación, con tildes y comillas', () => {
    const texto = [...doc.querySelectorAll('text')].map(t => t.textContent).join(' ');
    ['Thinking in Bets', 'Annie Duke', 'Resulting', 'Suerte y habilidad', 'Creencias como', 'PSICOLOGÍA Y CONDUCTA', 'LA IDEA CENTRAL'].forEach(c => expect(texto).toContain(c));
    expect(texto).toContain('decisión');
  });
  it('ningún texto baja de 20 unidades (≈ 11 px en móvil)', () => {
    const tamanos = [...doc.querySelectorAll('text')].map(t => parseFloat(t.getAttribute('font-size')));
    expect(Math.min(...tamanos)).toBeGreaterThanOrEqual(Mapa.MIN_FUENTE);
  });
  it('numera los nodos y dibuja un icono por nodo', () => {
    const nums = [...doc.querySelectorAll('text')].map(t => t.textContent).filter(t => /^[1-6]$/.test(t));
    expect(nums).toEqual(['1', '2', '3']);
    expect(doc.querySelectorAll('g[transform] ').length).toBe(3);
  });
  it('pesa poco (menos de 12 KB) y no lleva scripts ni imágenes externas', () => {
    expect(Buffer.byteLength(s)).toBeLessThan(12000);
    expect(s).not.toMatch(/<script|<image|<foreignObject|onload|href=/i);
  });
  it('escapa caracteres peligrosos en los textos', () => {
    const x = spec(); x.titulo = 'A & B <script>'; x.nodos[0].etiqueta = '"Comillas" y <b>';
    const out = Mapa.svg(x);
    expect(out).not.toContain('<script>');
    expect(() => new JSDOM(out, { contentType: 'image/svg+xml' })).not.toThrow();
  });
  it('lanza con una especificación inválida', () => {
    expect(() => Mapa.svg({ titulo: '', nodos: [] })).toThrow(/no válida/);
  });
  it('usa el acento del eje y permite sustituirlo', () => {
    expect(s).toContain(Mapa.ACENTOS['Psicología y Conducta']);
    expect(Mapa.svg(Object.assign(spec(), { acento: '#112233' }))).toContain('#112233');
  });
  it('aDataUri produce una URI usable en <img>', () => {
    expect(Mapa.aDataUri(s)).toMatch(/^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
  });
});
