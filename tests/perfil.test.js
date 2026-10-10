import { describe, it, expect } from 'vitest';
import Perfil from '../lib/perfil.js';
import Didactica from '../lib/didactica.js';

describe('Perfil.rutaPara', () => {
  it('elige la primera ruta preferida que esté disponible', () => {
    expect(Perfil.rutaPara('economia', ['dinero', 'economia'])).toBe('economia');
    expect(Perfil.rutaPara('economia', ['dinero'])).toBe('dinero');
  });
  it('null si no hay ruta disponible o el objetivo es explorar', () => {
    expect(Perfil.rutaPara('economia', [])).toBeNull();
    expect(Perfil.rutaPara('explorar', ['pensar'])).toBeNull();
    expect(Perfil.rutaPara('inventado', ['pensar'])).toBeNull();
  });
  it('todas las rutas de los objetivos existen en Didactica.RUTAS', () => {
    const ids = new Set(Didactica.RUTAS.map(r => r.id));
    Perfil.OBJETIVOS.forEach(o => o.rutas.forEach(r => expect(ids.has(r)).toBe(true)));
  });
});

describe('Perfil.crear', () => {
  it('normaliza respuestas válidas', () => {
    const p = Perfil.crear({ objetivo: 'decidir', minutos: 15, dias: 7 }, ['pensar']);
    expect(p).toMatchObject({ objetivo: 'decidir', minutos: 15, dias: 7, ruta: 'pensar', modo: 'completa' });
  });
  it('rellena con valores razonables si faltan o son inválidos', () => {
    const p = Perfil.crear({ objetivo: 'xx', minutos: 99, dias: 2 }, []);
    expect(p).toMatchObject({ objetivo: 'explorar', minutos: 7, dias: 5, ruta: null, modo: 'corta' });
  });
  it('3 y 7 minutos leen en modo corto; 15, completo', () => {
    expect(Perfil.modoPara(3)).toBe('corta');
    expect(Perfil.modoPara(7)).toBe('corta');
    expect(Perfil.modoPara(15)).toBe('completa');
  });
  it('completo distingue un perfil real de un «ahora no»', () => {
    expect(Perfil.completo(Perfil.crear({ objetivo: 'gente' }, []))).toBe(true);
    expect(Perfil.completo({ omitido: true })).toBe(false);
    expect(Perfil.completo(null)).toBe(false);
  });
});

describe('Didactica.dominios', () => {
  const libros = [
    { id: 'b1', eje_principal: 'Psicología y Conducta', sub_eje: 'Cognitiva' },
    { id: 'b2', eje_principal: 'Psicología y Conducta', sub_eje: 'Social' },
    { id: 'b3', eje_principal: 'Economía y Mercados', sub_eje: 'Economía' },
    { id: 'b4', eje_principal: 'Economía y Mercados', sub_eje: 'Economía' } // sin lecciones
  ];
  const lecs = [
    { id: 'l1', libro_id: 'b1' }, { id: 'l2', libro_id: 'b1' },
    { id: 'l3', libro_id: 'b2' }, { id: 'l4', libro_id: 'b3' }
  ];
  it('agrega por eje y sub-eje', () => {
    const d = Didactica.dominios(libros, lecs, new Set(['l1', 'l3']), new Set(['l1']));
    const psi = d.find(e => e.eje === 'Psicología y Conducta');
    expect(psi).toMatchObject({ total: 3, hechas: 2, asentadas: 1, pct: 67 });
    expect(psi.subs.find(s => s.sub === 'Cognitiva')).toMatchObject({ total: 2, hechas: 1, asentadas: 1, pct: 50 });
    expect(d.find(e => e.eje === 'Economía y Mercados')).toMatchObject({ total: 1, hechas: 0, pct: 0 });
  });
  it('ordena primero lo más leído', () => {
    const d = Didactica.dominios(libros, lecs, new Set(['l1', 'l2']), new Set());
    expect(d[0].eje).toBe('Psicología y Conducta');
  });
  it('ignora libros sin lecciones y tolera listas vacías', () => {
    expect(Didactica.dominios(libros, [], new Set())).toEqual([]);
  });
});

describe('rutas nuevas', () => {
  it('Emociones y atención y Economía básica resuelven contra los títulos reales', () => {
    const cat = ['Feeling Good', 'How Emotions Are Made', 'Get Out of Your Mind and Into Your Life', 'Dopamine Nation', 'Digital Minimalism', 'Deep Work',
      'Basic Economics', 'The Wealth of Nations', 'Production, Information Costs, and Economic Organization', 'Economic Analysis of Property Rights', 'Rationality in Economics']
      .map((t, i) => ({ id: 'x' + i, titulo: t, autor: 'a' }));
    const em = Didactica.resolverRuta(Didactica.RUTAS.find(r => r.id === 'emociones'), cat);
    const ec = Didactica.resolverRuta(Didactica.RUTAS.find(r => r.id === 'economia'), cat);
    expect(em.map(i => i.libro.titulo)).toEqual(cat.slice(0, 6).map(b => b.titulo));
    expect(ec.map(i => i.libro.titulo)).toEqual(cat.slice(6).map(b => b.titulo));
  });
});
