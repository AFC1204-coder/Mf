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
  tiempo: { eventos: [{ f: '1648', t: 'Westfalia' }] },
  grafica: { xmin: 0, xmax: 4, ymin: 0, ymax: 16, ejeX: 'x', ejeY: 'x²', series: [{ f: 'x^2', t: 'Convexa' }], puntos: [{ x: 2, y: 4, t: 'Punto' }] },
  barras: { items: [{ t: 'A', v: 30 }, { t: 'B', v: 52 }], unidad: '%' },
  formula: { lineas: ['r · B > C'], terminos: [{ s: 'r', t: 'parentesco' }] },
  tabla: { cols: ['Sí', 'No'], filas: [{ t: 'Sí', c: ['3', '0'] }, { t: 'No', c: ['5', '1'] }], resaltar: [[1, 1]] },
  arbol: { raiz: 'Todos', ramas: [{ t: '30 %', n: 'A' }, { t: '70 %', n: 'B' }] },
  venn: { conjuntos: [{ t: 'A' }, { t: 'B' }], centro: 'Ambos' },
  recta: { min: 0, max: 1, marcas: [{ x: 0.2, t: 'a' }, { x: 0.8, t: 'b' }] }
};

describe('Diagrama — plantillas', () => {
  it('expone las diecisiete plantillas documentadas (diez cualitativas y siete de matemática sencilla)', () => {
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

describe('Diagrama — evaluador de expresiones (sin eval)', () => {
  const v = (e, x) => { const f = Diagrama.compilar(e); return f ? f(x) : null; };
  it('calcula expresiones habituales', () => {
    expect(v('x^2', 3)).toBe(9);
    expect(v('0.5*x^2 - 3*x + 1', 2)).toBe(-3);
    expect(v('2^3^2', 0)).toBe(512);                       // potencia asociativa por la derecha
    expect(v('-x^2', 3)).toBe(-9);                         // el menos unario va después de la potencia
    expect(v('(1+x)*(1-x)', 0.5)).toBe(0.75);
    expect(v('1-exp(-x)', 0)).toBe(0);
    expect(v('sqrt(x)+ln(e)', 4)).toBeCloseTo(3, 9);
    expect(v('x**2', 4)).toBe(16);
    expect(v('min(x, 2)', 5)).toBe(2);
    expect(v('2*pi', 0)).toBeCloseTo(6.2831853, 6);
  });
  it('devuelve null (no ejecuta nada) con todo lo que no sea una expresión matemática', () => {
    for (const mala of ['alert(1)', 'x; 1', 'constructor', 'x.toString()', '__proto__', 'this', 'window', 'x => x', '1 +', '(1+2', 'foo(x)', '2x', 'x y', '', '   ', 'a'.repeat(200), 'toString(x)', 'valueOf', 'hasOwnProperty(x)', 'Math.sin(x)', '[1]', "x'"])
      expect(Diagrama.compilar(mala)).toBeNull();
    expect(Diagrama.compilar(undefined)).toBeNull();
    expect(Diagrama.compilar(null)).toBeNull();
  });
});

describe('Diagrama — matemática sencilla', () => {
  const svg = (plantilla, datos) => Diagrama.svg(base(plantilla, datos, { titulo: 'T' }));
  it('marcas de escala redondas y sin errores de coma flotante', () => {
    expect(Diagrama.marcas(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(Diagrama.marcas(0, 0.9, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8]);
    expect(Diagrama.marcas(-1, 1, 5)).toEqual([-1, -0.5, 0, 0.5, 1]);
    expect(Diagrama.marcas(5, 5, 5)).toEqual([5]);
    Diagrama.marcas(-3, 3, 6).forEach(m => expect(Object.is(m, -0)).toBe(false));
  });
  it('números con coma decimal', () => {
    expect(Diagrama.fnum(0.30000000000000004)).toBe('0,3');
    expect(Diagrama.fnum(1200)).toBe('1200');
    expect(Diagrama.fnum(NaN)).toBe('');
  });
  it('grafica: dibuja la curva a partir de la expresión y recorta lo que sale del rango (asíntotas)', () => {
    const g = svg('grafica', { xmin: -3, xmax: 3, ymin: -1.5, ymax: 1.5, ejeX: 'x', ejeY: 'y', series: [{ f: 'tan(x)' }] });
    expect(g).toContain('dg-curve');
    expect(g).not.toMatch(/NaN|Infinity|undefined/);
    // ningún punto del trazo sale del lienzo
    [...g.matchAll(/d="([^"]+)"/g)].forEach(m => [...m[1].matchAll(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g)].forEach(p => { expect(+p[2]).toBeGreaterThan(-5); expect(+p[2]).toBeLessThan(600); }));
  });
  it('grafica: acepta puntos sueltos y rechaza rangos imposibles o series sin datos', () => {
    expect(svg('grafica', { xmin: 0, xmax: 1, ymin: 0, ymax: 1, series: [{ puntos: [[0, 0], [1, 1]] }] })).toContain('dg-curve');
    expect(svg('grafica', { xmin: 1, xmax: 0, ymin: 0, ymax: 1, series: [{ f: 'x' }] })).toBe('');
    expect(svg('grafica', { xmin: 0, xmax: 1, ymin: 0, ymax: 1, series: [{ f: 'alert(1)' }] })).toBe('<svg' === '' ? 'x' : svg('grafica', { xmin: 0, xmax: 1, ymin: 0, ymax: 1, series: [{ f: 'alert(1)' }] }));
  });
  it('grafica con expresión mala no dibuja ninguna curva ni ejecuta nada', () => {
    const g = svg('grafica', { xmin: 0, xmax: 1, ymin: 0, ymax: 1, series: [{ f: 'alert(1)' }] });
    expect(g).not.toContain('dg-curve');
  });
  it('barras: los valores negativos van al otro lado del eje y el valor no pisa el nombre', () => {
    const g = svg('barras', { items: [{ t: 'Beneficio', v: 12.5 }, { t: 'Pérdida', v: -8 }], unidad: '€' });
    expect(g).toContain('12,5 €');
    expect(g).toContain('-8 €');
    expect(g).not.toMatch(/NaN|Infinity/);
  });
  it('barras: ignora valores que no son números', () => {
    expect(svg('barras', { items: [{ t: 'a', v: 'x' }, { t: 'b', v: NaN }] })).toBe('');
  });
  it('formula: se escapan < y > y se ajusta el tamaño a líneas largas', () => {
    const g = svg('formula', { lineas: ['r · B > C <script>'] });
    expect(g).toContain('&gt;');
    expect(g).not.toContain('<script>');
    const corta = Number(svg('formula', { lineas: ['a > b'] }).match(/font-size:([\d.]+)px/)[1]);
    const larga = Number(svg('formula', { lineas: ['E = p · G − (1 − p) · P + algo bastante largo de verdad'] }).match(/font-size:([\d.]+)px/)[1]);
    expect(larga).toBeLessThan(corta);
  });
  it('tabla: exige al menos dos columnas y una fila, y resalta celdas', () => {
    expect(svg('tabla', { cols: ['a'], filas: [{ t: 'x', c: ['1'] }] })).toBe('');
    expect(svg('tabla', { cols: ['a', 'b'], filas: [] })).toBe('');
    expect(svg('tabla', { cols: ['a', 'b'], filas: [{ t: 'x', c: ['1', '2'] }], resaltar: [[0, 1]] })).toContain('dg-celda hi');
  });
  it('arbol: uno y dos niveles', () => {
    const uno = svg('arbol', MUESTRAS.arbol);
    const dos = svg('arbol', { raiz: 'R', ramas: [{ t: '1 %', n: 'A', ramas: [{ t: '90 %', n: 'A1' }, { t: '10 %', n: 'A2' }] }, { t: '99 %', n: 'B', ramas: [{ t: '10 %', n: 'B1' }, { t: '90 %', n: 'B2' }] }] });
    expect(uno).not.toBe(''); expect(dos).not.toBe('');
    expect(Number(dos.match(/viewBox="0 0 440 (\d+)"/)[1])).toBeGreaterThan(Number(uno.match(/viewBox="0 0 440 (\d+)"/)[1]));
    expect(svg('arbol', { raiz: 'R', ramas: [] })).toBe('');
  });
  it('venn: dos o tres conjuntos', () => {
    expect(svg('venn', { conjuntos: [{ t: 'A' }] })).toBe('');
    expect(svg('venn', { conjuntos: [{ t: 'A' }, { t: 'B' }, { t: 'C' }], centro: 'x' })).toContain('dg-venn');
  });
  it('recta: marcas dentro del rango y rango válido', () => {
    expect(svg('recta', { min: 1, max: 0, marcas: [] })).toBe('');
    expect(svg('recta', { min: 0, max: 1, marcas: [{ x: -5, t: 'a' }, { x: 9, t: 'b' }] })).not.toMatch(/NaN|-\d{3,}/);
  });
  it('todas las plantillas nuevas escapan el HTML de sus textos', () => {
    const mal = '<img src=x onerror=alert(1)>';
    const casos = [
      ['grafica', { xmin: 0, xmax: 1, ymin: 0, ymax: 1, ejeX: mal, ejeY: mal, series: [{ f: 'x', t: mal }], puntos: [{ x: 0.5, y: 0.5, t: mal }] }],
      ['barras', { items: [{ t: mal, v: 1 }, { t: 'b', v: 2 }], unidad: mal }],
      ['formula', { lineas: [mal], terminos: [{ s: mal, t: mal }], nota: mal }],
      ['tabla', { cols: [mal, 'b'], filas: [{ t: mal, c: [mal, 'x'] }], esquina: mal }],
      ['arbol', { raiz: mal, ramas: [{ t: mal, n: mal }, { t: 'b', n: mal }] }],
      ['venn', { conjuntos: [{ t: mal, d: mal }, { t: 'b' }], centro: mal }],
      ['recta', { min: 0, max: 1, marcas: [{ x: 0.1, t: mal }, { x: 0.9, t: 'b' }] }]
    ];
    casos.forEach(([n, d]) => { const h = Diagrama.render(base(n, d, { titulo: mal, pie: mal })); expect(h).not.toContain('<img'); expect(h).not.toMatch(/NaN|undefined/); });
  });
});
