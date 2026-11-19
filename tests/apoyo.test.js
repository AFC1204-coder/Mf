import { describe, it, expect } from 'vitest';
import { revisar, revisarLote } from '../tools/datos/apoyo.mjs';

const leccion = {
  id: 'l1', libro: 'Pensar rápido y despacio', autor: 'Daniel Kahneman', titulo: 'El efecto de anclaje',
  cuerpo: 'Kahneman describe que un número inicial sesga la estimación posterior. En un experimento con ruletas, los participantes ' +
    'estimaron 45 países africanos en la ONU tras ver un número bajo y 65 tras uno alto. Strømme discrepa.',
  autocorreccion: 'Algunas réplicas muestran un efecto menor.', aplicacion_practica: 'Fija tu propia cifra antes de negociar.',
};
const fig = datos => ({ tipo: 'diagrama', plantilla: 'comparar', titulo: 'Anclaje', pie: 'Tesis de Kahneman.', datos });

describe('apoyo en la lección', () => {
  it('una figura fiel no da errores', () => {
    const r = revisar(fig({ izq: { t: 'Número bajo', items: ['Estimación de 45 países'] }, der: { t: 'Número alto', items: ['Estimación de 65 países'] } }), leccion);
    expect(r.errores).toEqual([]);
  });
  it('detecta una cifra que la lección no contiene', () => {
    const r = revisar(fig({ izq: { t: 'Número bajo', items: ['Estimación de 52 países'] }, der: { t: 'Número alto', items: ['Estimación de 65 países'] } }), leccion);
    expect(r.errores.join()).toMatch(/«52»/);
  });
  it('detecta un nombre propio inventado pero no el que abre la frase ni el que sí está', () => {
    const r = revisar(fig({ izq: { t: 'Tversky lo replicó', items: ['Kahneman lo describe'] }, der: { t: 'Número alto', items: ['Algo más'] } }), leccion);
    expect(r.errores.filter(e => /nombre/.test(e)).length).toBe(0);   // «Tversky» abre el bloque: no cuenta como nombre propio
    const r2 = revisar(fig({ izq: { t: 'Número bajo', items: ['Lo replicó Tversky después'] }, der: { t: 'Número alto', items: ['Algo más'] } }), leccion);
    expect(r2.errores.join()).toMatch(/«Tversky»/);
  });
  it('reconoce nombres con letras especiales y con guion', () => {
    const r = revisar(fig({ izq: { t: 'Número bajo', items: ['Discrepa Strømme'] }, der: { t: 'Número alto', items: ['Algo más'] } }), leccion);
    expect(r.errores).toEqual([]);
  });
  it('ignora las cifras de un solo dígito (pasos, «dos»…) y los años que sí están', () => {
    const r = revisar(fig({ izq: { t: 'Paso 1 y 2', items: ['Número bajo'] }, der: { t: 'Número alto', items: ['Algo'] } }), leccion);
    expect(r.errores).toEqual([]);
  });
  it('avisa de frases sin apoyo léxico, tolerando derivaciones', () => {
    const lejos = revisar(fig({ izq: { t: 'Número bajo', items: ['Inflación monetaria estructural persistente'] }, der: { t: 'Número alto', items: ['Algo'] } }), leccion);
    expect(lejos.avisos.length).toBe(1);
    const cerca = revisar(fig({ izq: { t: 'Número bajo', items: ['Estimaciones posteriores sesgadas'] }, der: { t: 'Número alto', items: ['Algo'] } }), leccion);
    expect(cerca.avisos).toEqual([]);
  });
  it('un lote con una lección desconocida lo dice', () => {
    const r = revisarLote({ zzz: [fig({ izq: { t: 'a', items: ['b', 'c'] }, der: { t: 'd', items: ['e', 'f'] } })] }, [leccion]);
    expect(r.zzz.errores[0]).toMatch(/no está/);
  });
});
