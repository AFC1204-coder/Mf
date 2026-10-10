import { describe, it, expect } from 'vitest';
import Diagrama from '../lib/diagram.js';

const base = (plantilla, datos, extra = {}) => ({ tipo: 'diagrama', plantilla, datos, ...extra });

const MUESTRAS = {
  pasos: { pasos: [{ t: 'Señal', d: 'Lo que dispara' }, { t: 'Respuesta' }, { t: 'Recompensa', tono: 'ok' }] },
  matriz: {
    ejeX: { izq: 'Mal', der: 'Bien' }, ejeY: { abajo: 'Mala', arriba: 'Buena' },
    celdas: [{ t: 'A' }, { t: 'B' }, { t: 'C' }, { t: 'D' }]
  },
  ciclo: { centro: 'R', nodos: [{ t: 'Uno' }, { t: 'Dos' }, { t: 'Tres' }] },
  comparar: { izq: { t: 'A', items: ['x', 'y'] }, der: { t: 'B', items: ['z'] } },
  espectro: { polos: ['Frágil', 'Antifrágil'], marcas: [{ pos: 0, t: 'a' }, { pos: 0.5, t: 'b' }, { pos: 1, t: 'c' }] },
  piramide: { niveles: [{ t: 'Cima' }, { t: 'Base' }] },
  mapa: { centro: 'Tema', nodos: [{ t: 'a' }, { t: 'b' }, { t: 'c' }] },
  curva: { puntos: [[0, 0.1], [0.5, 0.2], [1, 0.9]], etiquetas: [{ x: 0.5, y: 0.2, t: 'Valle' }] },
  cifras: { items: [{ n: '37×', t: 'compuesto' }] },
  tiempo: { eventos: [{ f: '1648', t: 'Westfalia' }] }
};

describe('Diagrama — plantillas', () => {
  it('expone las diez plantillas documentadas', () => {
    expect(Diagrama.plantillas.sort()).toEqual(Object.keys(MUESTRAS).sort());
  });

  Object.entries(MUESTRAS).forEach(([nombre, datos]) => {
    it(`${nombre}: produce un SVG válido con viewBox, rol y título`, () => {
      const svg = Diagrama.svg(base(nombre, datos, { titulo: 'Título' }));
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toMatch(/viewBox="0 0 440 \d+"/);
      expect(svg).toContain('role="img"');
      expect(svg).toContain('<title>Título</title>');
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
    });
  });

  it('el alto del viewBox crece con el contenido', () => {
    const alto = s => Number(Diagrama.svg(s).match(/viewBox="0 0 440 (\d+)"/)[1]);
    const poco = alto(base('pasos', { pasos: [{ t: 'a' }, { t: 'b' }] }));
    const mucho = alto(base('pasos', { pasos: Array.from({ length: 6 }, (_, i) => ({ t: 'Paso ' + i, d: 'texto '.repeat(20) })) }));
    expect(mucho).toBeGreaterThan(poco);
  });
});

describe('Diagrama — seguridad y robustez', () => {
  it('escapa HTML en todos los textos', () => {
    const html = Diagrama.render(base('pasos', { pasos: [{ t: '<img src=x onerror=alert(1)>', d: '"><script>x</script>' }] }, { titulo: '<b>t</b>', pie: '<i>p</i>' }));
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>t</b>');
    expect(html).toContain('&lt;img');
  });

  it('devuelve cadena vacía para specs inválidas', () => {
    expect(Diagrama.render(null)).toBe('');
    expect(Diagrama.render({})).toBe('');
    expect(Diagrama.render({ tipo: 'diagrama', plantilla: 'inexistente', datos: {} })).toBe('');
    expect(Diagrama.render({ tipo: 'otra', plantilla: 'pasos', datos: MUESTRAS.pasos })).toBe('');
    expect(Diagrama.render(base('pasos', {}))).toBe('');
    expect(Diagrama.render(base('matriz', { celdas: [{ t: 'solo una' }] }))).toBe('');
    expect(Diagrama.render(base('ciclo', { nodos: [{ t: 'a' }, { t: 'b' }] }))).toBe('');
  });

  it('un tono desconocido cae al tono por defecto', () => {
    const svg = Diagrama.svg(base('pasos', { pasos: [{ t: 'a', tono: 'rojo-neon"onload' }] }));
    expect(svg).not.toContain('onload');
    expect(svg).toContain('tn-a');
  });

  it('las posiciones del espectro fuera de rango se acotan', () => {
    const svg = Diagrama.svg(base('espectro', { polos: ['a', 'b'], marcas: [{ pos: -5, t: 'x' }, { pos: 9, t: 'y' }] }));
    expect(svg).not.toMatch(/NaN|-\d{3,}/);
  });
});

describe('Diagrama — figura y datos de lección', () => {
  it('render incluye figure, título, SVG y pie', () => {
    const h = Diagrama.render(base('pasos', MUESTRAS.pasos, { titulo: 'El bucle', pie: 'Nota' }));
    expect(h).toContain('<figure class="dg"');
    expect(h).toContain('<figcaption class="dg-title">El bucle</figcaption>');
    expect(h).toContain('<div class="dg-pie">Nota</div>');
  });

  it('deLeccion acepta lista, objeto suelto o JSON en texto y descarta lo inválido', () => {
    const ok = base('pasos', MUESTRAS.pasos);
    expect(Diagrama.deLeccion({ imagenes_inline: [ok, { foo: 1 }] })).toHaveLength(1);
    expect(Diagrama.deLeccion({ imagenes_inline: ok })).toHaveLength(1);
    expect(Diagrama.deLeccion({ imagenes_inline: JSON.stringify([ok]) })).toHaveLength(1);
    expect(Diagrama.deLeccion({ imagenes_inline: 'no es json' })).toEqual([]);
    expect(Diagrama.deLeccion({ imagenes_inline: [] })).toEqual([]);
    expect(Diagrama.deLeccion(null)).toEqual([]);
  });
});

describe('Diagrama.wrap', () => {
  it('parte por palabras sin superar el ancho', () => {
    const l = Diagrama.wrap('uno dos tres cuatro cinco seis siete ocho nueve diez', 100, 14);
    expect(l.length).toBeGreaterThan(1);
    l.forEach(x => expect(x.length).toBeLessThanOrEqual(14));
  });
  it('trocea palabras kilométricas', () => {
    const l = Diagrama.wrap('supercalifragilisticoespialidosoextraordinario', 80, 14);
    expect(l.length).toBeGreaterThan(1);
  });
  it('maneja vacío y null', () => {
    expect(Diagrama.wrap('', 100, 14)).toEqual([]);
    expect(Diagrama.wrap(null, 100, 14)).toEqual([]);
  });
});
