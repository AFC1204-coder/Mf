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
