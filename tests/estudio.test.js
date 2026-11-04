import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const E = createRequire(import.meta.url)('../lib/estudio.js');
const diaDe = f => new Date(f).toISOString().slice(0, 10);
const HOY = '2026-11-04';
const libros = [{ id: 'b1', titulo: 'Uno', eje: 'Mente' }, { id: 'b2', titulo: 'Dos', eje: 'Economía' }, { id: 'b3', titulo: 'Tres', eje: 'Historia' }];
const lecs = [
  { id: 'l1', libro_id: 'b1', titulo: 'A' }, { id: 'l2', libro_id: 'b1', titulo: 'B' },
  { id: 'l3', libro_id: 'b2', titulo: 'C' }, { id: 'l4', libro_id: 'b3', titulo: 'D' }, { id: 'l5', libro_id: 'b2', titulo: 'E' }
];
for (let i = 6; i <= 14; i++) lecs.push({ id: 'l' + i, libro_id: 'b1', titulo: 'M' + i });
const lee = (id, f) => ({ tipo: 'leccion', item_id: id, fecha: f, resultado: 'correcta' });

describe('Estudio · constancia', () => {
  it('racha actual cuenta si estuviste ayer; mejor racha de siempre', () => {
    expect(E.rachas(['2026-11-03', '2026-11-02', '2026-10-20', '2026-10-19', '2026-10-18'], HOY)).toEqual({ actual: 2, mejor: 3 });
    expect(E.rachas(['2026-11-04'], HOY).actual).toBe(1);
    expect(E.rachas(['2026-10-30'], HOY).actual).toBe(0);
    expect(E.rachas([], HOY)).toEqual({ actual: 0, mejor: 0 });
  });
  it('cuenta días activos, semanas y franjas', () => {
    const prog = [lee('l1', '2026-11-03T10:00:00'), lee('l2', '2026-11-04T10:00:00'), lee('l3', '2026-10-01T10:00:00')];
    const c = E.constancia({ prog, revisiones: ['2026-11-04T11:00:00'], respuestas: [], diaDe, hoy: HOY });
    expect(c.dias30).toBe(2); expect(c.diasTotal).toBe(3);
    expect(c.semanas).toHaveLength(8);
    expect(c.semanas[7].lecciones).toBe(2);      // semana actual (lunes 2 nov)
    expect(c.nLecturas).toBe(3);
    expect(c.franjas.mañana).toBe(3);
  });
});

describe('Estudio · variedad', () => {
  const prog = [lee('l1', '2026-11-01T10:00:00'), lee('l2', '2026-11-02T10:00:00'), lee('l3', '2026-09-01T10:00:00'), lee('l1', '2026-11-03T10:00:00')];
  const v = E.variedad({ prog, libros, lecs, diaDe, hoy: HOY });
  it('cuenta lecciones distintas, no lecturas repetidas', () => { expect(v.total).toBe(3); });
  it('libros tocados, terminados y empezados sin terminar', () => {
    expect(v.librosTocados).toBe(2); expect(v.terminados).toBe(0); expect(v.empezadosSinTerminar).toBe(2);
    expect(v.libros30).toBe(1);
  });
  it('reparto por eje y ejes sin tocar', () => {
    expect(v.ejes[0]).toMatchObject({ eje: 'Mente', lecciones: 2, pct: 67 });
    expect(v.ejesSinTocar).toEqual(['Historia']);
    expect(v.libroMasLeido.titulo).toBe('Uno');
  });
});

describe('Estudio · tiempo por libro', () => {
  it('suma minutos de lecciones distintas leídas y ordena por tiempo', () => {
    const prog = [lee('l1', '2026-11-01T10:00:00'), lee('l1', '2026-11-02T10:00:00'), lee('l3', '2026-11-03T10:00:00'), lee('l5', '2026-11-03T11:00:00')];
    const minutos = l => ({ l1: 4, l3: 9, l5: 6 })[l.id];
    const v = E.variedad({ prog, libros, lecs, diaDe, hoy: HOY, minutos });
    expect(v.minutosTotal).toBe(19);                       // l1 cuenta una sola vez
    expect(v.libroMasTiempo).toMatchObject({ titulo: 'Dos', minutos: 15, pct: 79 });
    expect(v.tiempoLibros.map(x => x.titulo)).toEqual(['Dos', 'Uno']);
  });
  it('sin función de minutos, cuenta 1 por lección', () => {
    expect(E.variedad({ prog: [lee('l1', '2026-11-01T10:00:00')], libros, lecs, diaDe, hoy: HOY }).minutosTotal).toBe(1);
  });
});

describe('Estudio · retención', () => {
  const repaso = [
    { estado: 'activa', leccion_id: 'l1', nivel: 4, veces_correcta: 5, veces_incorrecta: 0 },
    { estado: 'activa', leccion_id: 'l2', nivel: 1, veces_correcta: 1, veces_incorrecta: 4 },
    { estado: 'activa', pregunta_id: 'p9', nivel: 0, veces_correcta: 0, veces_incorrecta: 0 },
    { estado: 'dormida', leccion_id: 'l3', nivel: 0, veces_correcta: 0, veces_incorrecta: 9 }
  ];
  const r = E.retencion({ repaso, libros, lecs, preg: [{ id: 'p9', leccion_id: 'l3' }] });
  it('ignora tarjetas dormidas', () => { expect(r.intentos).toBe(10); expect(r.acierto).toBe(60); });
  it('asentadas = nivel ≥ 4; frágiles = poco acierto con intentos suficientes', () => {
    expect(r.asentadas).toBe(1);
    expect(r.fragiles.map(g => g.leccion_id)).toEqual(['l2']);
  });
  it('resuelve la lección de una pregunta por su pregunta_id', () => { expect(r.leccionesEnRepaso).toBe(3); });
  it('por eje', () => { expect(r.porEje.find(e => e.eje === 'Mente')).toMatchObject({ intentos: 10, acierto: 60 }); });
});

describe('Estudio · retos y observaciones', () => {
  const respuestas = [
    { tipo: 'predecir', resultado: 'acerto' }, { tipo: 'predecir', resultado: 'fallo' }, { tipo: 'predecir', resultado: null },
    { tipo: 'vida_real' }, { tipo: 'explicalo' }
  ];
  const t = E.retos({ respuestas, revisionesReto: [{ veredicto: 'igual' }, { veredicto: 'cambio' }], retosActivos: 17 });
  it('cuenta contestados, explícalos y predicciones', () => {
    expect(t.contestados).toBe(4); expect(t.explicalo).toBe(1);
    expect(t.predicciones).toMatchObject({ total: 3, comprobadas: 2, pendientes: 1, aciertoPct: 50 });
    expect(t.cambioPct).toBe(50);
  });
  it('no dice nada con muestras pequeñas', () => {
    const e = E.analizar({ prog: [lee('l1', '2026-11-04T10:00:00')], libros, lecs, repaso: [], respuestas, revisionesReto: [], diaDe, hoy: HOY });
    expect(e.observaciones).toEqual([]);
  });
  it('con muestra suficiente, observa franja, eje dominante y frágiles', () => {
    const prog = []; for (let i = 0; i < 12; i++) prog.push(lee('l' + (i < 2 ? i + 1 : i + 4), `2026-10-${10 + i}T22:00:00`));
    const repaso = [{ estado: 'activa', leccion_id: 'l1', nivel: 0, veces_correcta: 2, veces_incorrecta: 14 }];
    const e = E.analizar({ prog, libros, lecs, repaso, respuestas: [], revisionesReto: [], diaDe, hoy: HOY });
    const txt = e.observaciones.join(' | ');
    expect(txt).toMatch(/por la noche/); expect(txt).toMatch(/«Mente»/); expect(txt).toMatch(/se te olvida/);
  });
});
