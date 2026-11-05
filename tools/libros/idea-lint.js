/**
 * Comprobación mecánica de una «idea clave» generada para una lección (docs/estudio-mejoras.md §3).
 * No juzga si es buena: obliga a lo comprobable. La idea debe ser una síntesis FIEL: solo con lo que dice la lección.
 *  - longitud 40–220 caracteres, una sola frase o dos cortas, acabada en punto;
 *  - cada cifra o año de la idea aparece en el texto de la lección (cuerpo, autocorrección, aplicación, conexión);
 *  - al menos el 70 % de sus palabras con contenido aparecen en la lección (no introduce temas nuevos);
 *  - sin comillas, sin enlaces, sin viñetas, sin «según el autor» vacío ni fórmulas de relleno.
 * UMD: module.exports en Node/tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IdeaLint = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const STOP = new Set('para como pero esta este estos estas sobre entre desde hasta cuando donde porque tambien aunque cada solo mismo misma otros otras tiene tienen puede pueden hace hacen debe deben segun mucho muchos ellos ellas esto eso aquel una unos unas del los las que con por mas muy sin son ser fue han hay sus tus nos les lo la el en de y o a se su al es un no si ya ni que'.split(' '));
  const palabras = s => norm(s).split(/[^a-z0-9ñ]+/).filter(w => w.length >= 4 && !STOP.has(w));
  const cifras = s => (String(s || '').match(/\d[\d.,]*\d%?|\d%?/g) || []).map(x => x.replace(/[.,]$/, ''));
  const stem = w => w.replace(/(aciones|acion|amiento|amientos|mente|ando|iendo|ados|adas|idos|idas|ado|ada|ido|ida|ores|ora|or|es|as|os|a|o|s)$/, '');

  /** lec = { cuerpo, autocorreccion, aplicacion_practica, conexion_cruzada }. Devuelve { errores, avisos, cobertura }. */
  function lint(idea, lec) {
    const errores = [], avisos = [];
    const t = String(idea || '').trim();
    if (t.length < 40 || t.length > 220) errores.push(`longitud ${t.length} (debe estar entre 40 y 220)`);
    if (!/[.!?…]$/.test(t)) errores.push('no acaba en punto');
    if (/["“”«»]/.test(t)) errores.push('lleva comillas: la idea no es una cita');
    if (/https?:|www\.|^\s*[-*•]/i.test(t)) errores.push('lleva enlace o viñeta');
    if ((t.match(/[.!?…](\s|$)/g) || []).length > 2) errores.push('más de dos frases');
    if (/\b(el autor (dice|sostiene)|en esta lecci[oó]n|este cap[ií]tulo|la lecci[oó]n (explica|trata|habla))\b/i.test(t)) avisos.push('fórmula de relleno («la lección explica…»): mejor decir la idea');
    const base = [lec && lec.cuerpo, lec && lec.autocorreccion, lec && lec.aplicacion_practica, lec && lec.conexion_cruzada].join(' ');
    const bn = norm(base);
    cifras(t).forEach(c => { if (!bn.includes(norm(c))) errores.push(`la cifra «${c}» no aparece en la lección`); });
    const ws = [...new Set(palabras(t))];
    const raices = new Set(palabras(base).map(stem));
    const dentro = ws.filter(w => raices.has(stem(w)) || bn.includes(w));
    const cobertura = ws.length ? dentro.length / ws.length : 0;
    if (ws.length >= 5 && cobertura < 0.7) errores.push(`solo el ${Math.round(cobertura * 100)} % de sus palabras con contenido está en la lección (mínimo 70 %)`);
    return { errores, avisos, cobertura };
  }
  return { lint, cifras, palabras };
});
