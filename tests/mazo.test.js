import { describe, it, expect } from 'vitest';
import Mazo from '../lib/mazo.js';

const L = (id, libro, orden, extra) => Object.assign({ id, libro_id: libro, orden, titulo: 'T' + id, idea_clave: 'Una idea clave suficientemente larga ' + id, autocorreccion: 'Un matiz largo que matiza la idea y añade contrapunto suficiente para la ficha ' + id, cita_memorable: 'Una cita memorable ' + id }, extra || {});
const lecs = [L('a', 'B1', 1), L('b', 'B1', 2), L('c', 'B1', 3), L('d', 'B2', 1), L('e', 'B2', 2), L('f', 'B3', 1)];

describe('Mazo.componer', () => {
  it('cinco fichas como mucho, terminando en cierre', () => {
    const m = Mazo.componer({ lecs, completadas: new Set(['a', 'd']), siguiente: lecs[1], semilla: 1 });
    expect(m.length).toBeLessThanOrEqual(5);
    expect(m[m.length - 1].tipo).toBe('cierre');
  });
  it('abre con la idea de lo que toca leer, sigue con otra del mismo libro y luego recuerda algo leído', () => {
    const m = Mazo.componer({ lecs, completadas: new Set(['a', 'd']), siguiente: lecs[1], semilla: 2 });
    expect(m[0]).toMatchObject({ tipo: 'idea', lecId: 'b', siguiente: true });
    expect(m[1]).toMatchObject({ tipo: 'idea', lecId: 'c' });
    expect(m[2].tipo).toBe('recuerda');
    expect(m[m.length - 1]).toMatchObject({ tipo: 'cierre', lecId: 'b' });
  });
  it('el mazo gira en torno a un solo libro: recuerdo y matiz salen del libro de hoy si hay algo leído en él', () => {
    const libro = id => lecs.find(l => l.id === id).libro_id;
    for (let s = 0; s < 40; s++) {
      const m = Mazo.componer({ lecs, completadas: new Set(['a', 'd']), siguiente: lecs[1], semilla: s });
      const sinCierre = m.filter(f => f.tipo !== 'cierre');
      expect(new Set(sinCierre.map(f => libro(f.lecId)))).toEqual(new Set(['B1']));
    }
  });
  it('si en el libro de hoy no hay nada leído, el recuerdo viene de otro (y solo ese)', () => {
    const libro = id => lecs.find(l => l.id === id).libro_id;
    for (let s = 0; s < 30; s++) {
      const m = Mazo.componer({ lecs, completadas: new Set(['d', 'e']), siguiente: lecs[0], semilla: s });
      const libros = new Set(m.filter(f => f.tipo !== 'cierre').map(f => libro(f.lecId)));
      expect(libros.size).toBeLessThanOrEqual(2);   // el de hoy y el del recuerdo, nada más
      expect(m[0]).toMatchObject({ tipo: 'idea', lecId: 'a', siguiente: true });
    }
  });
  it('la primera ficha es siempre la oferta del día (lo que toca o lo que quedó a medias), no un recuerdo suelto', () => {
    for (let s = 0; s < 30; s++) {
      expect(Mazo.componer({ lecs, completadas: new Set(['a', 'd']), siguiente: lecs[1], semilla: s })[0].tipo).toBe('idea');
      expect(Mazo.componer({ lecs, completadas: new Set(['a', 'd']), siguiente: lecs[1], reanudar: { lec: lecs[2], restante: 2 }, semilla: s })[0].tipo).toBe('reanudar');
    }
  });
  it('sin lección que toque (todo leído) conserva el orden de siempre: recuerdo primero', () => {
    const m = Mazo.componer({ lecs, completadas: new Set(lecs.map(l => l.id)), siguiente: null, semilla: 7 });
    expect(m[0].tipo).toBe('recuerda');
    expect(m[m.length - 1].tipo).toBe('cierre');
  });
  it('si hay lectura a medias, la primera ficha es reanudarla y el cierre la ofrece', () => {
    const m = Mazo.componer({ lecs, completadas: new Set(), siguiente: lecs[0], reanudar: { lec: lecs[4], restante: 3 }, semilla: 3 });
    expect(m[0]).toMatchObject({ tipo: 'reanudar', lecId: 'e', restante: 3 });
    expect(m[m.length - 1]).toMatchObject({ tipo: 'cierre', lecId: 'e' });
  });
  it('no repite lecciones dentro del mazo', () => {
    for (let s = 0; s < 20; s++) {
      const m = Mazo.componer({ lecs, completadas: new Set(['a', 'b']), siguiente: lecs[2], semilla: s });
      const ids = m.filter(f => f.tipo !== 'cierre').map(f => f.lecId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it('sin nada leído no hay ficha de recuerdo, pero sí ideas', () => {
    const m = Mazo.componer({ lecs, completadas: new Set(), siguiente: null, semilla: 4 });
    expect(m.some(f => f.tipo === 'recuerda')).toBe(false);
    expect(m.filter(f => f.tipo === 'idea').length).toBe(2);
  });
  it('evita lo visto hace poco si hay alternativas', () => {
    const m = Mazo.componer({ lecs, completadas: new Set(), siguiente: null, vistas: ['a', 'b', 'c', 'd'], semilla: 5 });
    m.filter(f => f.tipo === 'idea').forEach(f => expect(['e', 'f']).toContain(f.lecId));
  });
  it('corpus vacío → solo el cierre', () => {
    expect(Mazo.componer({ lecs: [], semilla: 1 })).toEqual([{ tipo: 'cierre', lecId: null }]);
  });
});

describe('Mazo.decidirReanudar', () => {
  const ahora = 1_000_000_000;
  it('reabre una lectura activa reciente', () => {
    expect(Mazo.decidirReanudar({ lecId: 'x', ts: ahora - 3600e3, activa: true, y: 0.4 }, ahora, new Set())).toBe('abrir');
  });
  it('si ya la terminaste, nada', () => {
    expect(Mazo.decidirReanudar({ lecId: 'x', ts: ahora - 1000, activa: true }, ahora, new Set(['x']))).toBeNull();
  });
  it('antigua o no activa pero avanzada → ficha; sin avance → nada', () => {
    expect(Mazo.decidirReanudar({ lecId: 'x', ts: ahora - 20 * 3600e3, activa: true, y: 0.3 }, ahora, new Set())).toBe('ficha');
    expect(Mazo.decidirReanudar({ lecId: 'x', ts: ahora - 3600e3, activa: false, y: 0.3 }, ahora, new Set())).toBe('ficha');
    expect(Mazo.decidirReanudar({ lecId: 'x', ts: ahora - 3600e3, activa: false, y: 0 }, ahora, new Set())).toBeNull();
    expect(Mazo.decidirReanudar({ lecId: 'x', ts: ahora - 10 * 24 * 3600e3, activa: false, y: 0.5 }, ahora, new Set())).toBeNull();
    expect(Mazo.decidirReanudar(null, ahora)).toBeNull();
  });
  it('minutos restantes', () => {
    expect(Mazo.minutosRestantes(10, 0.6)).toBe(4);
    expect(Mazo.minutosRestantes(10, 1)).toBe(1);
    expect(Mazo.minutosRestantes(8, -1)).toBe(8);
  });
});

describe('Mazo.extracto', () => {
  it('corta por frases sin pasarse', () => {
    const t = 'Primera frase. Segunda frase algo más larga. Tercera.';
    expect(Mazo.extracto(t, 30)).toBe('Primera frase.');
    expect(Mazo.extracto('corto', 30)).toBe('corto');
  });
});

describe('Mazo.componer · fichas con esquema', () => {
  it('sin lección que toque, las ideas salen de lecciones con esquema si las hay', () => {
    const conFigura = l => ['e', 'f'].includes(l.id);
    for (let s = 1; s <= 20; s++) {
      const m = Mazo.componer({ lecs, completadas: new Set(), siguiente: null, semilla: s, conFigura });
      const ideas = m.filter(f => f.tipo === 'idea').map(f => f.lecId);
      expect(ideas.length).toBeGreaterThan(0);
      ideas.forEach(id => expect(['e', 'f']).toContain(id));
    }
  });
  it('si ninguna tiene esquema, funciona igual que antes', () => {
    const m = Mazo.componer({ lecs, completadas: new Set(), siguiente: null, semilla: 3, conFigura: () => false });
    expect(m.filter(f => f.tipo === 'idea').length).toBeGreaterThan(0);
  });
  it('un conFigura que falla no rompe el mazo', () => {
    const m = Mazo.componer({ lecs, completadas: new Set(), siguiente: null, semilla: 3, conFigura: () => { throw new Error('x'); } });
    expect(m[m.length - 1].tipo).toBe('cierre');
  });
});
