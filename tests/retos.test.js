import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const R = createRequire(import.meta.url)('../lib/retos.js');
const T0 = new Date('2026-11-04T10:00:00Z');
const dias = (f, n) => Math.round((new Date(f) - T0) / 86400000);

describe('Retos · lógica pura', () => {
  it('limpia el texto y rechaza vacío o excesivo', () => {
    expect(R.limpiarTexto('  hola \r\n')).toBe('hola');
    expect(R.limpiarTexto('   ')).toBeNull();
    expect(R.limpiarTexto('x'.repeat(2001))).toBeNull();
    expect(R.limpiarTexto(null)).toBeNull();
  });
  it('predicción vuelve a los 30 días; el resto, a los 7', () => {
    const p = R.nuevaRespuesta({ tipo: 'predecir', texto: 'Creo que sí', leccion_id: 'L', reto_id: 'R' }, T0);
    expect(dias(p.proxima_revision)).toBe(30);
    const o = R.nuevaRespuesta({ tipo: 'otra_cara', texto: 'Creo que no', leccion_id: 'L' }, T0);
    expect(dias(o.proxima_revision)).toBe(7);
    expect(o.reto_id).toBeNull();
  });
  it('rechaza tipo desconocido, sin lección o sin texto', () => {
    expect(R.nuevaRespuesta({ tipo: 'quiz', texto: 'a', leccion_id: 'L' })).toBeNull();
    expect(R.nuevaRespuesta({ tipo: 'vida_real', texto: 'a' })).toBeNull();
    expect(R.nuevaRespuesta({ tipo: 'vida_real', texto: '', leccion_id: 'L' })).toBeNull();
  });
  it('«explícalo» se acepta sin reto', () => {
    expect(R.nuevaRespuesta({ tipo: 'explicalo', texto: 'Con mis palabras', leccion_id: 'L' }, T0)).toBeTruthy();
  });
  it('revisión: igual sube de nivel, matizo mantiene, cambio reinicia', () => {
    expect(R.trasRevision({ nivel: 0 }, 'igual', T0).nivel).toBe(1);
    expect(dias(R.trasRevision({ nivel: 0 }, 'igual', T0).proxima_revision)).toBe(21);
    expect(R.trasRevision({ nivel: 2 }, 'matizo', T0).nivel).toBe(2);
    expect(R.trasRevision({ nivel: 3 }, 'cambio', T0).nivel).toBe(0);
    expect(R.trasRevision({ nivel: 3 }, 'igual', T0).nivel).toBe(3);   // tope
    expect(R.trasRevision({ nivel: 0 }, 'otro', T0)).toBeNull();
  });
  it('predicción: acierto/fallo/a medias la cierran; «aún no» la aplaza 30 días', () => {
    const p = { tipo: 'predecir', nivel: 0 };
    ['acerto', 'fallo', 'a_medias'].forEach(r => {
      const c = R.resolverPrediccion(p, r, T0);
      expect(c.resultado).toBe(r); expect(c.resuelta_at).toBeTruthy();
    });
    const a = R.resolverPrediccion(p, 'aun_no', T0);
    expect(a.resuelta_at).toBeUndefined(); expect(dias(a.proxima_revision)).toBe(30);
    expect(R.resolverPrediccion({ tipo: 'vida_real' }, 'acerto', T0)).toBeNull();   // solo predicciones
    expect(R.resolverPrediccion(p, 'quizá', T0)).toBeNull();
  });
  it('pendientes separa predicciones y reflexiones, ignora resueltas y futuras', () => {
    const rs = [
      { id: 1, tipo: 'predecir', proxima_revision: '2026-11-01T00:00:00Z' },
      { id: 2, tipo: 'vida_real', proxima_revision: '2026-10-20T00:00:00Z' },
      { id: 3, tipo: 'otra_cara', proxima_revision: '2026-12-01T00:00:00Z' },
      { id: 4, tipo: 'predecir', proxima_revision: '2026-10-01T00:00:00Z', resuelta_at: '2026-10-02T00:00:00Z' }
    ];
    const p = R.pendientes(rs, T0);
    expect(p.predicciones.map(r => r.id)).toEqual([1]);
    expect(p.reflexiones.map(r => r.id)).toEqual([2]);
  });
  it('registro agrupa por autor o idea y cuenta aciertos, fallos y pendientes', () => {
    const rs = [
      { leccion_id: 'a', tipo: 'predecir', resultado: 'acerto' },
      { leccion_id: 'a', tipo: 'predecir', resultado: 'fallo' },
      { leccion_id: 'b', tipo: 'predecir', resultado: null },
      { leccion_id: 'b', tipo: 'otra_cara' }
    ];
    const info = id => ({ a: { autor: 'Simon', idea: 'Ceder' }, b: { autor: 'McRaney', idea: 'Audiencia' } })[id];
    const g = R.registro(rs, info, 'autor');
    expect(g.map(x => x.clave)).toEqual(['McRaney', 'Simon']);
    expect(g[1]).toMatchObject({ acerto: 1, fallo: 1, pendientes: 0 });
    expect(g[0]).toMatchObject({ pendientes: 1 });
    expect(R.registro(rs, info, 'idea').map(x => x.clave)).toEqual(['Audiencia', 'Ceder']);
  });
  it('hace() es sobrio', () => {
    expect(R.hace('2026-11-04T08:00:00Z', T0)).toBe('hoy');
    expect(R.hace('2026-11-01T10:00:00Z', T0)).toBe('hace 3 días');
    expect(R.hace('2026-10-07T10:00:00Z', T0)).toBe('hace 4 semanas');
    expect(R.hace('2026-06-04T10:00:00Z', T0)).toBe('hace 5 meses');
  });
});
