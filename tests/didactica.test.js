import { describe, it, expect } from 'vitest';
import Didactica from '../lib/didactica.js';

const {
  minutosLectura, avance, relacionados, preguntasParaLeccion, progresoLibro,
  siguienteLeccion, resolverRuta, rutasDisponibles, RUTAS, norm
} = Didactica;

describe('minutosLectura', () => {
  it('mínimo 1 minuto', () => {
    expect(minutosLectura({ cuerpo: 'corto' })).toBe(1);
    expect(minutosLectura(null)).toBe(1);
  });
  it('≈190 palabras por minuto, sumando todas las secciones', () => {
    const w = n => Array.from({ length: n }, () => 'palabra').join(' ');
    expect(minutosLectura({ cuerpo: w(380) })).toBe(2);
    expect(minutosLectura({ cuerpo: w(190), aplicacion_practica: w(190), conexion_cruzada: w(190) })).toBe(3);
    expect(minutosLectura({ cuerpo: w(190), detalles: [{ cuerpo: w(190) }] })).toBe(2);
  });
});

describe('avance', () => {
  it('prefiere la idea clave', () => {
    expect(avance({ idea_clave: 'La idea.', cuerpo: 'Otra cosa.' })).toBe('La idea.');
  });
  it('usa la primera frase del cuerpo', () => {
    expect(avance({ cuerpo: 'Primera frase. Segunda frase.' })).toBe('Primera frase.');
  });
  it('recorta frases largas en límite de palabra con elipsis', () => {
    const t = avance({ cuerpo: 'palabra '.repeat(60) + '.' }, 50);
    expect(t.endsWith('…')).toBe(true);
    expect(t.length).toBeLessThanOrEqual(52);
    expect(t).not.toMatch(/palabr…$/);
  });
  it('quita marcas markdown y tolera vacío', () => {
    expect(avance({ cuerpo: '**Clave** del _asunto_. Más.' })).toBe('Clave del asunto.');
    expect(avance({})).toBe('');
    expect(avance(null)).toBe('');
  });
});

const libros = [
  { id: 'a', titulo: 'Thinking in Bets', autor: 'Annie Duke', sub_eje: 'Cognitiva', eje_principal: 'Psicología y Conducta' },
  { id: 'b', titulo: 'Thinking, Fast and Slow', autor: 'Daniel Kahneman', sub_eje: 'Cognitiva', eje_principal: 'Psicología y Conducta' },
  { id: 'c', titulo: 'Los Hombres son de Marte', autor: 'John Gray', sub_eje: 'Interpersonal', eje_principal: 'Psicología y Conducta' },
  { id: 'd', titulo: 'Libro vacío', autor: 'Nadie', sub_eje: 'Cognitiva', eje_principal: 'Psicología y Conducta' },
  { id: 'e', titulo: 'Fooled by Randomness', autor: 'Nassim Taleb', sub_eje: 'Cognitiva', eje_principal: 'Psicología y Conducta' }
];
const lecs = [
  { id: 'l1', libro_id: 'a', orden: 1, titulo: 'Resulting', cuerpo: 'x', autores_relacionados: ['Daniel Kahneman', 'Nassim Nicholas Taleb'] },
  { id: 'l2', libro_id: 'a', orden: 2, titulo: 'Otra', cuerpo: 'y' },
  { id: 'l3', libro_id: 'b', orden: 1, titulo: 'S1', cuerpo: 'z' },
  { id: 'l4', libro_id: 'c', orden: 1, titulo: 'M', cuerpo: 'w' },
  { id: 'l5', libro_id: 'e', orden: 1, titulo: 'R', cuerpo: 'v' }
];

describe('relacionados', () => {
  it('prioriza autores cruzados y mismo sub-eje; excluye el propio y los vacíos', () => {
    const r = relacionados(libros[0], libros, lecs, 3).map(b => b.id);
    expect(r).toEqual(['e', 'b']); // empate de puntos → orden alfabético por título
    expect(r).not.toContain('a');
    expect(r).not.toContain('d');
    expect(r).not.toContain('c');
  });
  it('respeta el máximo', () => {
    expect(relacionados(libros[0], libros, lecs, 1)).toHaveLength(1);
  });
  it('null → []', () => { expect(relacionados(null, libros, lecs)).toEqual([]); });
});

describe('preguntasParaLeccion', () => {
  const pregs = [
    { id: 'p1', libro_id: 'a', texto: '¿Qué es el resulting?', explicacion: 'Juzgar por resultados', opciones: ['a', 'b'] },
    { id: 'p2', libro_id: 'a', texto: '¿Qué mide la calibración probabilística?', explicacion: 'Aciertos', opciones: ['a', 'b'] },
    { id: 'p3', libro_id: 'b', texto: '¿Qué es el resulting?', explicacion: '', opciones: ['a', 'b'] },
    { id: 'p4', libro_id: 'a', texto: 'Sin opciones', explicacion: 'resulting', opciones: [] }
  ];
  it('elige la pregunta del mismo libro más afín al título', () => {
    const r = preguntasParaLeccion({ libro_id: 'a', titulo: 'Resulting', cuerpo: 'El resulting es...' }, pregs, 1);
    expect(r.map(p => p.id)).toEqual(['p1']);
  });
  it('no mezcla libros ni preguntas sin opciones', () => {
    const r = preguntasParaLeccion({ libro_id: 'a', titulo: 'Resulting', cuerpo: 'resulting calibración probabilística' }, pregs, 5);
    expect(r.map(p => p.id).sort()).toEqual(['p1', 'p2']);
  });
  it('sin coincidencias → []', () => {
    expect(preguntasParaLeccion({ libro_id: 'a', titulo: 'Zzz', cuerpo: 'qqq' }, pregs, 2)).toEqual([]);
  });
});

describe('progreso y siguiente lección', () => {
  it('calcula porcentaje', () => {
    expect(progresoLibro(libros[0], lecs, new Set(['l1']))).toEqual({ total: 2, hechas: 1, pct: 50 });
    expect(progresoLibro(libros[3], lecs, new Set())).toEqual({ total: 0, hechas: 0, pct: 0 });
  });
  it('siguiente = primera sin completar por orden; null si todo hecho', () => {
    expect(siguienteLeccion(libros[0], lecs, new Set(['l1'])).id).toBe('l2');
    expect(siguienteLeccion(libros[0], lecs, new Set()).id).toBe('l1');
    expect(siguienteLeccion(libros[0], lecs, new Set(['l1', 'l2']))).toBeNull();
  });
});

describe('rutas de aprendizaje', () => {
  const cat = [
    'El arte de pensar', 'Thinking, Fast and Slow', 'Thinking in Bets', 'The Scout Mindset',
    'Superforecasting', 'El Cisne Negro', 'The Fourth Turning Is Here', 'The Fourth Turning',
    'Influencia', 'Signal and the Noise', 'Noise: A Flaw in Human Judgment'
  ].map((t, i) => ({ id: 'id' + i, titulo: t, autor: 'x' }));

  it('todas las rutas tienen id único, al menos 5 libros y un porqué por libro', () => {
    expect(new Set(RUTAS.map(r => r.id)).size).toBe(RUTAS.length);
    RUTAS.forEach(r => {
      expect(r.libros.length).toBeGreaterThanOrEqual(5);
      r.libros.forEach(l => { expect(l.m).toBeTruthy(); expect(l.por.length).toBeGreaterThan(20); });
    });
  });
  it('resuelve por título sin acentos y en orden pedagógico', () => {
    const items = resolverRuta(RUTAS.find(r => r.id === 'pensar'), cat);
    expect(items.map(i => i.libro.titulo)).toEqual([
      'El arte de pensar', 'Thinking, Fast and Slow', 'Thinking in Bets', 'The Scout Mindset', 'Superforecasting', 'El Cisne Negro'
    ]);
  });
  it('"=" exige título exacto: no confunde The Fourth Turning con The Fourth Turning Is Here', () => {
    const r = resolverRuta(RUTAS.find(r => r.id === 'instituciones'), cat);
    expect(r.map(i => i.libro.titulo)).toEqual(['The Fourth Turning']);
  });
  it('"Noise" no captura The Signal and the Noise', () => {
    const r = resolverRuta(RUTAS.find(r => r.id === 'riesgo'), cat);
    expect(r.map(i => i.libro.titulo)).toEqual(['Noise: A Flaw in Human Judgment']);
  });
  it('oculta las rutas con menos de 3 libros publicados', () => {
    const rs = rutasDisponibles(cat, [], new Set());
    expect(rs.map(r => r.id)).toEqual(['pensar']);
  });
  it('agrega el progreso de la ruta', () => {
    const ls = [{ id: 'x1', libro_id: 'id0' }, { id: 'x2', libro_id: 'id0' }, { id: 'x3', libro_id: 'id1' }];
    const r = rutasDisponibles(cat, ls, new Set(['x1'])).find(r => r.id === 'pensar');
    expect(r).toMatchObject({ total: 3, hechas: 1, pct: 33 });
  });
  it('norm quita acentos', () => { expect(norm('Compórtate')).toBe('comportate'); });
});

describe('Didactica.preguntasParaLeccion — leccion_id explícito', () => {
  const lec = { id: 'L2', libro_id: 'B', titulo: 'Sesgo de confirmación', cuerpo: 'buscamos lo que confirma' };
  const op = [{ t: 'a' }, { t: 'b' }];
  const pregs = [
    { id: 'p1', libro_id: 'B', texto: 'sesgo de confirmación', explicacion: '', opciones: op, leccion_id: 'L1' },
    { id: 'p2', libro_id: 'B', texto: 'pregunta sin parecido alguno', explicacion: '', opciones: op, leccion_id: 'L2' },
    { id: 'p3', libro_id: 'B', texto: 'confirmación', explicacion: '', opciones: op }
  ];
  it('las preguntas asignadas a esa lección van primero aunque se parezcan menos', () => {
    expect(preguntasParaLeccion(lec, pregs, 1).map(p => p.id)).toEqual(['p2']);
  });
  it('una pregunta asignada a otra lección no se usa por parecido', () => {
    expect(preguntasParaLeccion(lec, pregs, 3).map(p => p.id)).toEqual(['p2', 'p3']);
  });
});
