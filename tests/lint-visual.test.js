import { describe, it, expect } from 'vitest';
import LintVisual from '../lib/lint-visual.js';
import { fusionar } from '../tools/datos/agregar.mjs';

const ok = () => ({ tipo: 'diagrama', plantilla: 'pasos', titulo: 'Tres pasos para decidir', pie: 'El orden importa.',
  datos: { pasos: [{ t: 'Separar', d: 'Decisión y resultado' }, { t: 'Estimar', d: 'Probabilidades' }, { t: 'Revisar' }] } });

describe('LintVisual.diagrama', () => {
  it('acepta un diagrama bueno', () => { expect(LintVisual.diagrama(ok())).toEqual([]); });
  it('exige título y pie', () => {
    const s = ok(); delete s.titulo; delete s.pie;
    expect(LintVisual.diagrama(s).join()).toMatch(/falta el título/);
    expect(LintVisual.diagrama(s).join()).toMatch(/falta el pie/);
  });
  it('detecta faltas de tilde y ñ perdidas', () => {
    const s = ok(); s.datos.pasos[0].t = 'Prediccion entrenable'; s.titulo = 'El diseno del sistema';
    const e = LintVisual.diagrama(s).join(' | ');
    expect(e).toMatch(/falta de tilde/);
    expect(e).toMatch(/ñ perdida/);
  });
  it('no confunde palabras con tilde con faltas («seleccionó», «decisión», «sección»)', () => {
    const s = ok(); s.pie = 'Easter lo seleccionó; es una decisión y una sección clara.';
    expect(LintVisual.diagrama(s).join()).not.toMatch(/falta de tilde/);
  });
  it('limita número de pasos y largo de textos', () => {
    const s = ok(); s.datos.pasos = [{ t: 'a' }, { t: 'b' }];
    expect(LintVisual.diagrama(s).join()).toMatch(/pasos: 2/);
    const t = ok(); t.datos.pasos[0].t = 'x'.repeat(60);
    expect(LintVisual.diagrama(t).join()).toMatch(/demasiado largo/);
  });
  it('una cifra o fecha sin dígitos se rechaza (dato inventado o mal puesto)', () => {
    const c = { tipo: 'diagrama', plantilla: 'cifras', titulo: 'Cifras', pie: 'Del texto.', datos: { items: [{ n: 'muchos', t: 'algo' }] } };
    expect(LintVisual.diagrama(c).join()).toMatch(/sin dígitos/);
    const t = { tipo: 'diagrama', plantilla: 'tiempo', titulo: 'Fechas', pie: 'Del texto.', datos: { eventos: [{ f: 'antes', t: 'a' }, { f: '1648', t: 'b' }] } };
    expect(LintVisual.diagrama(t).join()).toMatch(/sin dígitos/);
  });
  it('una plantilla desconocida no es válida', () => {
    expect(LintVisual.diagrama({ tipo: 'diagrama', plantilla: 'x', datos: {} })[0]).toMatch(/no es un diagrama válido/);
  });
  it('rechaza caracteres que rompen el SVG', () => {
    const s = ok(); s.datos.pasos[0].t = 'a <b> c';
    expect(LintVisual.diagrama(s).join()).toMatch(/caracteres no permitidos/);
  });
});

describe('LintVisual.mapa', () => {
  const m = () => ({ titulo: 'Libro', nodos: [{ etiqueta: 'Uno', icono: 'dado' }, { etiqueta: 'Dos', icono: 'ojo' }, { etiqueta: 'Tres', icono: 'red' }] });
  it('acepta uno bueno y rechaza uno con tildes perdidas', () => {
    expect(LintVisual.mapa(m())).toEqual([]);
    const x = m(); x.nodos[0].etiqueta = 'Decision rapida';
    expect(LintVisual.mapa(x).join()).toMatch(/falta de tilde/);
  });
});

describe('agregar.fusionar', () => {
  it('guarda lo válido, rechaza lo malo con su motivo y ordena las claves', () => {
    const malo = ok(); malo.datos.pasos[0].t = 'Decision';
    const r = fusionar('diagramas', { z: [ok()] }, { b: [ok()], a: [malo] });
    expect(r.aceptadas).toEqual(['b']);
    expect(r.rechazadas[0].id).toBe('a');
    expect(Object.keys(r.datos)).toEqual(['b', 'z']);
  });
  it('no pierde lo que ya había', () => {
    const r = fusionar('diagramas', { z: [ok()] }, { b: [ok()] });
    expect(r.datos.z).toBeDefined();
  });
});

describe('LintVisual — matemática sencilla', () => {
  const base = (plantilla, datos, extra = {}) => ({ tipo: 'diagrama', plantilla, titulo: 'Un título claro', pie: 'Un pie claro.', datos, ...extra });
  const buena = base('grafica', { xmin: 0, xmax: 4, ymin: 0, ymax: 16, ejeX: 'Tamaño', ejeY: 'Efecto', series: [{ f: 'x^2', t: 'Convexa' }] });
  it('acepta una gráfica buena', () => { expect(LintVisual.diagrama(buena)).toEqual([]); });
  it('rechaza una expresión que no es matemática', () => {
    const s = JSON.parse(JSON.stringify(buena)); s.datos.series[0].f = 'alert(1)';
    expect(LintVisual.diagrama(s).join()).toMatch(/no es válida/);
  });
  it('rechaza una curva que no entra en el rango o no está definida', () => {
    const a = JSON.parse(JSON.stringify(buena)); a.datos.series[0].f = '1000+x';
    expect(LintVisual.diagrama(a).join()).toMatch(/casi no entra/);
    const b = JSON.parse(JSON.stringify(buena)); b.datos.series[0].f = 'ln(x-10)';
    expect(LintVisual.diagrama(b).join()).toMatch(/no está definida/);
  });
  it('exige ejes con nombre y rangos coherentes', () => {
    const s = JSON.parse(JSON.stringify(buena)); delete s.datos.ejeX; s.datos.xmax = -1;
    const e = LintVisual.diagrama(s).join(' | ');
    expect(e).toMatch(/ejeX/); expect(e).toMatch(/xmax debe ser mayor/);
  });
  it('una gráfica sin escala debe decir que es ilustrativa', () => {
    const s = JSON.parse(JSON.stringify(buena)); s.datos.sinEscala = true;
    expect(LintVisual.diagrama(s).join()).toMatch(/ilustrativa/);
    s.pie = 'Forma ilustrativa, sin escala real.';
    expect(LintVisual.diagrama(s)).toEqual([]);
  });
  it('permite < y > solo en las líneas de una fórmula', () => {
    const f = base('formula', { lineas: ['r · B > C'], terminos: [{ s: 'r', t: 'parentesco' }] });
    expect(LintVisual.diagrama(f)).toEqual([]);
    const g = base('formula', { lineas: ['r · B > C'], terminos: [{ s: 'r', t: 'a < b' }] });
    expect(LintVisual.diagrama(g).join()).toMatch(/caracteres no permitidos/);
  });
  it('las demás plantillas nuevas validan sus datos', () => {
    expect(LintVisual.diagrama(base('barras', { items: [{ t: 'A', v: 3 }, { t: 'B', v: 5 }], unidad: '%' }))).toEqual([]);
    expect(LintVisual.diagrama(base('barras', { items: [{ t: 'A', v: 3 }] })).join()).toMatch(/barras: 1/);
    expect(LintVisual.diagrama(base('tabla', { cols: ['a', 'b'], filas: [{ t: 'x', c: ['1', '2'] }], resaltar: [[3, 0]] })).join()).toMatch(/fuera de la tabla/);
    expect(LintVisual.diagrama(base('tabla', { cols: ['a', 'b'], filas: [{ t: 'x', c: ['1'] }] })).join()).toMatch(/debe tener 2 celdas/);
    expect(LintVisual.diagrama(base('arbol', { raiz: 'R', ramas: [{ t: '1 %', n: 'A', ramas: [{ n: '1' }, { n: '2' }, { n: '3' }] }, { t: '99 %', n: 'B', ramas: [{ n: '1' }, { n: '2' }, { n: '3' }] }, { t: 'x', n: 'C', ramas: [{ n: '1' }, { n: '2' }, { n: '3' }] }] })).join()).toMatch(/demasiadas hojas/);
    expect(LintVisual.diagrama(base('venn', { conjuntos: [{ t: 'A' }, { t: 'B' }], centro: 'Ambos' }))).toEqual([]);
    expect(LintVisual.diagrama(base('recta', { min: 0, max: 1, marcas: [{ x: 0.2, t: 'a' }, { x: 3, t: 'b' }] })).join()).toMatch(/fuera del rango/);
  });
});

describe('agregar.mjs — figuras adicionales', () => {
  const extra = () => ({ tipo: 'diagrama', plantilla: 'formula', titulo: 'Una fórmula clara', pie: 'Un pie claro.', adicional: true, datos: { lineas: ['a > b'], terminos: [{ s: 'a', t: 'algo' }] } });
  const previa = { tipo: 'diagrama', plantilla: 'pasos', titulo: 'Tres pasos', pie: 'Un pie.', datos: { pasos: [{ t: 'Uno' }, { t: 'Dos' }, { t: 'Tres' }] } };
  it('--anadir suma la figura a las que ya tenía la lección', () => {
    const r = fusionar('diagramas', { L1: [previa] }, { L1: [extra()] }, { anadir: true });
    expect(r.aceptadas).toEqual(['L1']);
    expect(r.datos.L1).toHaveLength(2);
    expect(r.datos.L1[0].plantilla).toBe('pasos');
    expect(r.datos.L1[1].plantilla).toBe('formula');
  });
  it('--anadir no duplica y exige «adicional»', () => {
    const una = fusionar('diagramas', { L1: [previa] }, { L1: [extra()] }, { anadir: true }).datos;
    expect(fusionar('diagramas', una, { L1: [extra()] }, { anadir: true }).datos.L1).toHaveLength(2);
    const sin = extra(); delete sin.adicional;
    const r = fusionar('diagramas', { L1: [previa] }, { L1: [sin] }, { anadir: true });
    expect(r.rechazadas[0].errores.join()).toMatch(/adicional/);
    expect(r.datos.L1).toHaveLength(1);
  });
  it('sin --anadir sustituye, como siempre', () => {
    expect(fusionar('diagramas', { L1: [previa] }, { L1: [extra()] }).datos.L1).toHaveLength(1);
  });
});
