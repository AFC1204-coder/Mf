/**
 * Lint determinista de un «cruce» (ensayo que une lecciones de varios libros) antes de cargarlo.
 * No juzga si algo es verdad: obliga a la forma, a que todo lo que se afirma tenga lección de origen
 * y a que los esquemas pasen el lint visual.
 *
 * Uso:  node tools/cruces/lint.js cruce.json
 *       node tools/cruces/lint.js cruce.json --barajar   (reparte la posición de las correctas y reescribe el fichero)
 */
const fs = require('fs');
const crypto = require('crypto');
const OpcionesQ = require('../../lib/opciones.js');
const LintVisual = require('../../lib/lint-visual.js');

const TIPOS = ['convergencia', 'tension', 'complementariedad'];
const PROCESO = /de memoria|no pude (confirmar|verificar)|sin acceso al texto|no he podido (confirmar|verificar)|según (mi|mis) (conocimiento|fuentes)|como (modelo|ia)\b/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const n = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function lint(c) {
  const errores = [], avisos = [];
  const err = (d, m) => errores.push(`${d}: ${m}`);
  const av = (d, m) => avisos.push(`${d}: ${m}`);
  const rango = (d, v, a, b, que) => { if (!(v >= a && v <= b)) err(d, `${que}: ${v} (debe estar entre ${a} y ${b})`); };

  ['titulo', 'pregunta_generadora', 'tipo', 'cuerpo', 'convergencias', 'divergencias', 'lectura_cruzada', 'aplicacion', 'cautelas'].forEach(k => { if (!c[k] || typeof c[k] !== 'string') err('campos', `falta «${k}»`); });
  if (!TIPOS.includes(c.tipo)) err('tipo', 'debe ser convergencia | tension | complementariedad');
  rango('titulo', String(c.titulo || '').length, 8, 90, 'caracteres');
  rango('pregunta_generadora', String(c.pregunta_generadora || '').length, 20, 220, 'caracteres');
  rango('cuerpo', n(c.cuerpo), 200, 480, 'palabras');
  ['convergencias', 'divergencias', 'lectura_cruzada', 'aplicacion'].forEach(k => rango(k, n(c[k]), 40, 220, 'palabras'));
  rango('cautelas', n(c.cautelas), 15, 120, 'palabras');

  // Fuentes
  const fuentes = Array.isArray(c.fuentes) ? c.fuentes : [];
  rango('fuentes', fuentes.length, 4, 8, 'lecciones de origen');
  const ids = new Set();
  fuentes.forEach((f, i) => {
    const d = 'fuente ' + (i + 1);
    if (!UUID.test(f.leccion_id || '')) err(d, 'leccion_id no es un uuid');
    if (ids.has(f.leccion_id)) err(d, 'lección repetida');
    ids.add(f.leccion_id);
    if (!f.libro || !f.autor) err(d, 'falta libro o autor');
    if (n(f.aporta) < 5) err(d, '«aporta» demasiado corto');
  });
  const libros = new Set(fuentes.map(f => norm(f.libro)));
  if (libros.size < 3) err('fuentes', 'hacen falta al menos 3 libros distintos');
  if (Array.isArray(c.autores_convocados) && c.autores_convocados.length < 3) err('autores_convocados', 'al menos 3');
  if (!Array.isArray(c.autores_convocados)) err('autores_convocados', 'debe ser una lista');
  if (!Array.isArray(c.libros_referenciados) || c.libros_referenciados.length < 3) err('libros_referenciados', 'al menos 3');

  // Esquemas (se enseñan antes que el texto; los mismos límites que el resto de la app)
  const esq = Array.isArray(c.esquemas) ? c.esquemas : [];
  rango('esquemas', esq.length, 3, 4, 'esquemas');
  esq.forEach((s, i) => {
    const r = LintVisual.diagrama(s);
    (Array.isArray(r) ? r : (r && r.errores) || []).forEach(m => err('esquema ' + (i + 1), m));
  });

  // Cápsulas
  const cap = Array.isArray(c.capsulas) ? c.capsulas : [];
  rango('cápsulas', cap.length, 3, 4, 'cápsulas');
  cap.forEach((k, i) => {
    const d = 'cápsula ' + (i + 1);
    rango(d + ' · título', String(k.titulo || '').length, 6, 70, 'caracteres');
    rango(d + ' · texto', n(k.texto), 60, 150, 'palabras');
    if (!Number.isInteger(k.esquema) || k.esquema < 0 || k.esquema >= esq.length) err(d, 'esquema debe ser el índice de un esquema (0-' + (esq.length - 1) + ')');
    if (!Array.isArray(k.fuentes) || !k.fuentes.length) err(d, 'sin lecciones de origen');
    (k.fuentes || []).forEach(id => { if (!ids.has(id)) err(d, 'cita una lección que no está en «fuentes»: ' + id); });
  });

  // Preguntas
  const preg = Array.isArray(c.preguntas) ? c.preguntas : [];
  rango('preguntas', preg.length, 4, 6, 'preguntas');
  let masLarga = 0;
  preg.forEach((p, i) => {
    const d = 'pregunta ' + (i + 1);
    rango(d + ' · texto', String(p.texto || '').length, 15, 260, 'caracteres');
    rango(d + ' · explicación', String(p.explicacion || '').length, 40, 500, 'caracteres');
    OpcionesQ.revisarPregunta(p).forEach(f => err(d, f));
    const fp = Array.isArray(p.fuentes) ? p.fuentes : [];
    if (new Set(fp.map(id => (fuentes.find(f => f.leccion_id === id) || {}).libro)).size < 2) err(d, 'debe apoyarse en lecciones de al menos 2 libros distintos (campo «fuentes»)');
    fp.forEach(id => { if (!ids.has(id)) err(d, 'cita una lección que no está en «fuentes»: ' + id); });
    if (Array.isArray(p.opciones) && Number.isInteger(p.correcta)) {
      const lc = String(p.opciones[p.correcta]).length;
      if (p.opciones.every((o, k) => k === p.correcta || String(o).length < lc)) masLarga++;
    }
  });
  if (preg.length && masLarga / preg.length > 0.4) av('preguntas', `la correcta es la más larga en ${masLarga}/${preg.length}`);

  // Texto que no debe llegar al usuario, y cifras sin lección de origen
  const todo = [c.titulo, c.pregunta_generadora, c.cuerpo, c.convergencias, c.divergencias, c.lectura_cruzada, c.aplicacion, c.cautelas,
    ...cap.map(k => k.titulo + ' ' + k.texto), ...preg.map(p => p.texto + ' ' + (p.opciones || []).join(' ') + ' ' + p.explicacion)].join('\n');
  if (PROCESO.test(todo)) err('texto', 'contiene una frase que describe el proceso de generación');
  if (/[«»]/.test(todo)) err('texto', 'no uses citas entre « » (no hay citas literales verificadas); parafrasea');
  const cifras = (todo.match(/\b\d[\d.,]*\b/g) || []).filter(x => x.replace(/\D/g, '').length >= 2);
  if (cifras.length) av('cifras', 'aparecen cifras o años (' + [...new Set(cifras)].slice(0, 8).join(', ') + '): deben figurar en una lección fuente');
  return { errores, avisos, resumen: { fuentes: fuentes.length, libros: libros.size, esquemas: esq.length, capsulas: cap.length, preguntas: preg.length } };
}

function barajar(c) {
  const h = (p, k) => crypto.createHash('md5').update(p.texto + '|' + k).digest('hex');
  [...c.preguntas].sort((a, b) => h(a, 'pos').localeCompare(h(b, 'pos'))).forEach((p, i) => {
    const obj = i % 4, corr = p.opciones[p.correcta];
    const otras = p.opciones.filter((_, k) => k !== p.correcta).sort((a, b) => h(p, a).localeCompare(h(p, b)));
    p.opciones = [...otras.slice(0, obj), corr, ...otras.slice(obj)]; p.correcta = obj;
  });
  return c;
}

module.exports = { lint, barajar };
if (require.main === module) {
  const f = process.argv[2];
  let c = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (process.argv.includes('--barajar')) { c = barajar(c); fs.writeFileSync(f, JSON.stringify(c, null, 1)); console.log('Barajadas', c.preguntas.length, 'preguntas'); }
  const r = lint(c);
  r.errores.forEach(e => console.log('ERROR', e)); r.avisos.forEach(a => console.log('AVISO', a));
  console.log(JSON.stringify(r.resumen)); console.log(r.errores.length ? 'FALLA' : 'OK');
  process.exit(r.errores.length ? 1 : 0);
}
