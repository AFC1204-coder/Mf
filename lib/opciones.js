/**
 * Calidad de las opciones de una pregunta tipo test — la parte pura.
 * Auditoría 2026-10: en el 92 % de las preguntas la correcta era la opción más larga, y en los
 * lotes antiguos casi siempre ocupaba la posición 0 o 1. Aquí se comprueba y se corrige al generar.
 *
 * UMD: window.OpcionesQ en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OpcionesQ = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const REFERENCIAL = /todas las anteriores|ninguna de las|\bambas\b|^\s*[a-d] y [a-d]\b|opci[oó]n [a-d]\b/i;
  const RATIO_MIN = 0.7;
  const RATIO_MAX = 1.3;

  /** Mezcla Fisher–Yates con un generador de azar inyectable (por defecto Math.random). */
  function barajarOpciones(p, azar) {
    const rnd = typeof azar === 'function' ? azar : Math.random;
    const op = (p.opciones || []).slice();
    const orden = op.map((_, i) => i);
    for (let i = orden.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [orden[i], orden[j]] = [orden[j], orden[i]];
    }
    return Object.assign({}, p, { opciones: orden.map(i => op[i]), correcta: orden.indexOf(p.correcta) });
  }

  /** Problemas que delatan la correcta o rompen el formato. Lista vacía = buena. */
  function revisarPregunta(p) {
    const fallos = [];
    const op = p && p.opciones;
    if (!Array.isArray(op) || op.length !== 4) return ['no tiene 4 opciones'];
    if (!Number.isInteger(p.correcta) || p.correcta < 0 || p.correcta > 3) return ['índice de correcta no válido'];
    if (new Set(op.map(o => String(o).trim().toLowerCase())).size !== 4) fallos.push('opciones repetidas');
    const lc = String(op[p.correcta]).length;
    op.forEach((o, i) => {
      if (REFERENCIAL.test(String(o))) fallos.push('la opción ' + (i + 1) + ' remite a otras opciones');
      if (i === p.correcta) return;
      const r = String(o).length / (lc || 1);
      if (r < RATIO_MIN || r > RATIO_MAX) fallos.push('la opción ' + (i + 1) + ' mide ' + Math.round(r * 100) + ' % de la correcta');
    });
    return fallos;
  }

  return { barajarOpciones, revisarPregunta, RATIO_MIN, RATIO_MAX };
});
