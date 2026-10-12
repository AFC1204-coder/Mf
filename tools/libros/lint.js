/**
 * Lint determinista de un «paquete de libro» antes de publicarlo.
 * No juzga si algo es verdad: obliga a que lo comprobable (cifras, citas literales, autores del corpus,
 * forma de las preguntas) esté declarado y a que el paquete tenga la anatomía de los libros del corpus.
 *
 * Uso:  node tools/libros/lint.js paquete.json autores.json   (autores.json = lista de autores del corpus)
 * UMD: module.exports en Node/tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../../lib/opciones.js'));
  else root.LibroLint = factory(root.OpcionesQ);
})(typeof self !== 'undefined' ? self : this, function (OpcionesQ) {
  'use strict';

  const EJES = ['Pensamiento y Civilización', 'Psicología y Conducta', 'Economía y Mercados', 'Neurociencia y Biología', 'Desarrollo Humano'];
  const CAMPOS_TEXTO = ['cuerpo', 'conexion_cruzada', 'autocorreccion', 'aplicacion_practica'];

  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const palabras = s => norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 4);
  const entre = (s, a, b) => { const n = String(s || '').length; return n >= a && n <= b; };

  /** Cifras que hay que declarar: años, porcentajes y números de dos o más cifras. */
  function cifrasEn(texto) {
    const out = new Set();
    String(texto || '').replace(/\d[\d.,]*\d%?|\d%/g, m => { out.add(m.replace(/[.,]$/, '')); return m; });
    return [...out];
  }

  /** Citas con comillas de ≥ 6 palabras (candidatas a ser literales). */
  function citasEn(texto) {
    const out = [];
    String(texto || '').replace(/[«"“]([^»"”]{20,})[»"”]/g, (_, c) => { if (c.trim().split(/\s+/).length >= 6) out.push(c.trim()); return _; });
    return out;
  }

  function lint(paq, autoresCorpus) {
    const errores = [];
    const avisos = [];
    const err = (donde, msg) => errores.push(donde + ': ' + msg);
    const avi = (donde, msg) => avisos.push(donde + ': ' + msg);
    const apellidos = new Set((autoresCorpus || []).flatMap(a => String(a).split(/[\s,&]+|\sy\s/).map(norm).filter(w => w.length > 3)));

    const L = paq && paq.libro;
    if (!L) return { errores: ['falta «libro»'], avisos };
    if (!L.autor || !L.titulo) err('libro', 'faltan autor o título');
    if (!Number.isInteger(L.año) || L.año < 1500 || L.año > 2026) err('libro', 'año no válido');
    if (!EJES.includes(L.eje_principal)) err('libro', 'eje_principal no es uno de los cinco del corpus');
    if (!L.sub_eje) err('libro', 'falta sub_eje');
    if (!entre(L.descripcion_breve, 60, 400)) err('libro', 'descripcion_breve debe medir 60–400 caracteres');
    if (!['alta', 'media', 'baja'].includes(paq.confianza)) err('libro', 'confianza debe ser alta, media o baja');

    const cifrasOk = new Set((paq.cifras || []).filter(c => c && c.estado === 'verificada' && c.fuente).map(c => String(c.valor)));
    const citasOk = (paq.citas_literales || []).filter(c => c && c.verificada && c.fuente).map(c => norm(c.texto));
    const lecs = paq.lecciones || [];
    if (lecs.length < 4 || lecs.length > 16) err('libro', 'debe tener entre 4 y 16 lecciones');

    const textos = new Set();
    let posiciones = [0, 0, 0, 0];
    let nPreg = 0;

    lecs.forEach((lec, i) => {
      const d = 'lección ' + (i + 1);
      if (lec.orden !== i + 1) err(d, 'orden debe ser consecutivo desde 1');
      if (!entre(lec.titulo, 8, 90)) err(d, 'título de 8–90 caracteres');
      if (!entre(lec.cuerpo, 850, 2700)) err(d, 'cuerpo de 850–2700 caracteres (hay ' + String(lec.cuerpo || '').length + ')');
      if (String(lec.cuerpo || '').split(/\n\s*\n/).length < 3) err(d, 'el cuerpo necesita al menos 3 párrafos');
      if (!entre(lec.idea_clave, 40, 220)) err(d, 'idea_clave de 40–220 caracteres');
      if (!entre(lec.cita_memorable, 30, 240)) err(d, 'cita_memorable (idea) de 30–240 caracteres');
      if (!entre(lec.conexion_cruzada, 200, 900)) err(d, 'conexion_cruzada de 200–900 caracteres');
      if (!entre(lec.autocorreccion, 150, 800)) err(d, 'autocorreccion de 150–800 caracteres');
      if (!entre(lec.aplicacion_practica, 120, 700)) err(d, 'aplicacion_practica de 120–700 caracteres');

      const rel = lec.autores_relacionados || [];
      if (rel.length < 2 || rel.length > 6) err(d, 'autores_relacionados: entre 2 y 6');
      if (!rel.some(a => norm(a).split(/\W+/).some(w => apellidos.has(w)))) err(d, 'ningún autor relacionado está en el corpus');
      if (apellidos.size && ![...apellidos].some(a => norm(lec.conexion_cruzada).includes(a))) err(d, 'la conexión cruzada no nombra a ningún autor del corpus');

      CAMPOS_TEXTO.forEach(c => {
        cifrasEn(lec[c]).forEach(x => { if (!cifrasOk.has(x)) err(d + ' · ' + c, 'cifra «' + x + '» sin declarar y verificar en «cifras»'); });
        citasEn(lec[c]).forEach(q => { if (!citasOk.some(k => k.includes(norm(q)) || norm(q).includes(k))) err(d + ' · ' + c, 'cita entrecomillada sin verificar en «citas_literales»: «' + q.slice(0, 40) + '…»'); });
      });

      const preg = lec.preguntas || [];
      if (preg.length < 2 || preg.length > 4) err(d, 'entre 2 y 4 preguntas (hay ' + preg.length + ')');
      const soporte = palabras(lec.cuerpo + ' ' + lec.aplicacion_practica + ' ' + lec.autocorreccion);
      preg.forEach((p, j) => {
        const dp = d + ' · pregunta ' + (j + 1);
        nPreg++;
        if (!entre(p.texto, 15, 260)) err(dp, 'texto de 15–260 caracteres');
        if (!entre(p.explicacion, 40, 500)) err(dp, 'explicación de 40–500 caracteres');
        if (![1, 2, 3].includes(p.dificultad)) err(dp, 'dificultad 1–3');
        OpcionesQ.revisarPregunta(p).forEach(f => err(dp, f));
        if (textos.has(norm(p.texto))) err(dp, 'texto repetido');
        textos.add(norm(p.texto));
        if (Array.isArray(p.opciones) && Number.isInteger(p.correcta)) {
          posiciones[p.correcta] = (posiciones[p.correcta] || 0) + 1;
          // ¿Se puede responder con lo que dice la lección? La correcta debería apoyarse en el texto más que las demás.
          const apoyo = o => { const w = palabras(o); return w.length ? w.filter(x => soporte.includes(x)).length / w.length : 0; };
          const ac = apoyo(p.opciones[p.correcta]);
          const maxOtra = Math.max(...p.opciones.map((o, k) => (k === p.correcta ? 0 : apoyo(o))));
          if (maxOtra > ac + 0.15) avi(dp, 'una incorrecta se apoya más en el texto de la lección que la correcta (' + maxOtra.toFixed(2) + ' vs ' + ac.toFixed(2) + ')');
          if (ac < 0.2) avi(dp, 'la correcta casi no se apoya en el texto de la lección (' + ac.toFixed(2) + ')');
        }
      });
    });
    if (nPreg >= 8 && Math.max(...posiciones) / nPreg > 0.45) err('libro', 'la respuesta correcta se concentra en una posición: ' + posiciones.join('/'));
    return { errores, avisos, resumen: { lecciones: lecs.length, preguntas: nPreg, posiciones } };
  }

  return { lint, cifrasEn, citasEn, EJES };
});

if (require.main === module) {
  const fs = require('fs');
  const [, , paq, aut] = process.argv;
  const r = module.exports.lint(JSON.parse(fs.readFileSync(paq, 'utf8')), aut ? JSON.parse(fs.readFileSync(aut, 'utf8')) : []);
  console.log(JSON.stringify(r.resumen || {}));
  r.avisos.forEach(a => console.log('AVISO ', a));
  r.errores.forEach(e => console.log('ERROR ', e));
  console.log(r.errores.length ? 'FALLA: ' + r.errores.length + ' error(es)' : 'OK');
  process.exit(r.errores.length ? 1 : 0);
}
