import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const C = require('../lib/consulta.js');

const libros = [
  { id: 'L1', autor: 'Autora Uno', titulo: 'El poder de los hábitos pequeños', eje_principal: 'Desarrollo Humano', sub_eje: 'Crecimiento Personal', descripcion_breve: 'Cómo cambiar la conducta con rutinas mínimas.' },
  { id: 'L2', autor: 'Autor Dos', titulo: 'Atención plena en la era digital', eje_principal: 'Neurociencia y Biología', sub_eje: 'Neurociencia', descripcion_breve: 'Atención, distracción y tecnología.' },
  { id: 'L3', autor: 'Autor Tres', titulo: 'Negociar sin ceder', eje_principal: 'Psicología y Conducta', sub_eje: 'Interpersonal', descripcion_breve: 'Acuerdos y conflicto.' },
  { id: 'L4', autor: 'Autor Tres', titulo: 'Negociar con calma', eje_principal: 'Psicología y Conducta', sub_eje: 'Interpersonal', descripcion_breve: 'Más sobre negociación.' },
  { id: 'L5', autor: 'Autor Tres', titulo: 'Negociar en equipo', eje_principal: 'Psicología y Conducta', sub_eje: 'Interpersonal', descripcion_breve: 'Más sobre negociación y acuerdos.' },
  { id: 'L6', autor: 'Autor Seis', titulo: 'Historia del imperio romano', eje_principal: 'Pensamiento y Civilización', sub_eje: 'Historia', descripcion_breve: 'Roma.' },
];
const lec = (id, libro_id, titulo, idea_clave, extra = {}) => ({ id, libro_id, titulo, idea_clave, orden: 1, activa: true, cuerpo: '', ...extra });
const lecciones = [
  lec('a1', 'L1', 'Procrastinar es regular emociones', 'Aplazamos tareas para evitar una emoción incómoda; los hábitos pequeños y la rutina ayudan a empezar.', { dominio_aplicacion: ['hábitos', 'motivación'] }),
  lec('a2', 'L1', 'Diseña el entorno', 'Cambia el contexto antes que la voluntad: la disciplina depende del entorno.', { dominio_aplicacion: ['hábitos'] }),
  lec('b1', 'L2', 'El móvil secuestra la atención', 'Las notificaciones fragmentan la concentración y cuestan minutos de foco cada vez.', { dominio_aplicacion: ['atención', 'tecnología'] }),
  lec('c1', 'L3', 'Intereses, no posiciones', 'En una negociación conviene preguntar por intereses; un acuerdo mejor nace de ahí.', { dominio_aplicacion: ['negociación'] }),
  lec('c2', 'L4', 'Prepara tu alternativa', 'Conocer tu mejor alternativa a un acuerdo da poder al negociar.', { dominio_aplicacion: ['negociación'] }),
  lec('c3', 'L5', 'Negociar en grupo', 'Los equipos negocian peor si no reparten roles; el acuerdo requiere preparación.', { dominio_aplicacion: ['negociación'] }),
  lec('d1', 'L6', 'La caída de Roma', 'Las instituciones romanas se erosionaron con la guerra civil y la desigualdad.', { dominio_aplicacion: ['historia'] }),
];
const ix = C.construirIndice(libros, lecciones);

describe('normalización y raíces', () => {
  it('quita tildes (también la ñ) y mayúsculas', () => expect(C.normalizar('Atención ÑANDÚ')).toBe('atencion nandu'));
  it('casa formas de la misma palabra', () => {
    expect(C.raiz('concentrarme')).toBe(C.raiz('concentración'));
    expect(C.raiz('procrastino')).toBe(C.raiz('procrastinar'));
  });
  it('no confunde móvil con movilidad', () => expect(C.raiz('móvil')).not.toBe(C.raiz('movilidad')));
  it('ignora palabras vacías', () => expect(C.palabras('quiero un libro para la atención')).toEqual(['atencion']));
});

describe('detección de necesidades', () => {
  const ids = t => C.detectarTemas(t).map(x => x.tema.id);
  it('reconoce lenguaje cotidiano', () => {
    expect(ids('Procrastino y no consigo mantener buenos hábitos')).toContain('habitos');
    expect(ids('Me cuesta concentrarme y miro el móvil todo el rato')).toContain('atencion');
    expect(ids('Quiero negociar mi sueldo')).toContain('negociacion');
  });
  it('«acabo… todo» no es una crisis', () => expect(ids('Me cuesta concentrarme y acabo mirando el móvil todo el rato')).not.toContain('crisis'));
  it('«negocio» no es negociar', () => { expect(ids('Quiero montar mi propio negocio')).not.toContain('negociacion'); expect(ids('Quiero montar mi propio negocio')).toContain('emprender'); });
  it('«público» no activa publicidad', () => expect(ids('Quiero hablar en público')).not.toContain('persuasion'));
  it('detecta crisis solo con la frase exacta', () => {
    expect(ids('a veces pienso en el suicidio')).toContain('crisis');
    expect(ids('no quiero vivir así')).toContain('crisis');
    expect(ids('quiero vivir mejor')).not.toContain('crisis');
  });
});

describe('consulta', () => {
  it('recomienda el libro adecuado para una necesidad cotidiana', () => {
    const r = C.consultar(ix, 'Procrastino y me cuesta mantener hábitos');
    expect(r.resultados[0].libro.id).toBe('L1');
    expect(r.resultados[0].empezarPor.id).toBe('a1');
  });
  it('traduce el lenguaje cotidiano al vocabulario del corpus', () => {
    const r = C.consultar(ix, 'No consigo concentrarme por culpa del móvil');
    expect(r.resultados[0].libro.id).toBe('L2');
    expect(r.temas.map(t => t.id)).toContain('atencion');
  });
  it('explica por qué: cobertura, lecciones y necesidades cubiertas', () => {
    const r = C.consultar(ix, 'Quiero negociar un acuerdo');
    const x = r.resultados[0];
    expect(x.cobertura).toBeGreaterThan(30);
    expect(x.lecciones.length).toBeGreaterThan(0);
    expect(x.responde.length).toBeGreaterThan(0);
    expect(['alto', 'medio', 'parcial']).toContain(x.nivel);
  });
  it('limita los libros del mismo autor', () => {
    const r = C.consultar(ix, 'Quiero negociar un acuerdo', { porAutor: 2 });
    expect(r.resultados.filter(x => x.libro.autor === 'Autor Tres').length).toBeLessThanOrEqual(2);
  });
  it('filtra por eje', () => {
    const r = C.consultar(ix, 'hábitos y atención', { eje: 'Neurociencia y Biología' });
    expect(r.resultados.every(x => x.libro.eje_principal === 'Neurociencia y Biología')).toBe(true);
  });
  it('no inventa: sin coincidencias devuelve motivo y ningún libro', () => {
    const r = C.consultar(ix, 'xyzzy plugh');
    expect(r.resultados).toEqual([]);
    expect(r.motivo).toBeTruthy();
  });
  it('pide más texto si la consulta es demasiado corta', () => expect(C.consultar(ix, 'a').motivo).toBe('corto'));
  it('ante riesgo vital da el mensaje de ayuda y no recomienda libros', () => {
    const r = C.consultar(ix, 'estoy pensando en el suicidio');
    expect(r.crisis).toContain('024');
    expect(r.resultados).toEqual([]);
  });
  it('en temas de salud añade el aviso de que no sustituye a un profesional', () => {
    const r = C.consultar(ix, 'siento mucha ansiedad y estrés');
    expect(r.aviso).toBe(C.AVISO_SENSIBLE);
  });
  it('no recomienda las lecciones inactivas ni los libros sin ficha', () => {
    const ix2 = C.construirIndice(libros, [...lecciones, lec('z1', 'L6', 'Hábitos de Roma', 'hábitos hábitos hábitos', { activa: false }), lec('z2', 'NOEXISTE', 'Hábitos', 'hábitos')]);
    const r = C.consultar(ix2, 'hábitos');
    expect(r.resultados.map(x => x.libro.id)).not.toContain('NOEXISTE');
    expect(r.resultados.flatMap(x => x.lecciones.map(l => l.lec.id))).not.toContain('z1');
  });
});

describe('resaltar', () => {
  it('marca las palabras de la consulta y escapa el HTML', () => {
    const html = C.resaltar('La atención <b>fragmentada</b> y los hábitos', [C.raiz('atención'), C.raiz('hábitos')]);
    expect(html).toContain('<mark class="hl">atención</mark>');
    expect(html).toContain('<mark class="hl">hábitos</mark>');
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('<b>');
  });
});

describe('léxico', () => {
  it('cada tema tiene id único y claves', () => {
    const ids = C.TEMAS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of C.TEMAS) expect(t.claves.length).toBeGreaterThan(0);
  });
  it('los ejemplos de la interfaz reconocen al menos un tema', () => {
    for (const e of C.EJEMPLOS) expect(C.detectarTemas(e).length, e).toBeGreaterThan(0);
  });
});
