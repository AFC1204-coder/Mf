/**
 * Lectura automática — cuándo una lección cuenta como leída sin pulsar el botón.
 * Hacen falta dos cosas a la vez: haber pasado un tiempo razonable con la lección a la vista
 * (una fracción de su tiempo de lectura estimado) y haber llegado al final del texto.
 * Así no se marca por abrirla ni por deslizar de golpe hasta abajo.
 *
 * UMD: window.LeidaAuto en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LeidaAuto = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Fracción del tiempo de lectura estimado que debe haber pasado con la lección a la vista. */
  const FRACCION = 0.35;
  const SEG_MIN = 25;
  const SEG_MAX = 150;
  /** Cuánto puede quedar por debajo de la ventana el final del texto y seguir contando (px). */
  const MARGEN_PX = 80;

  /** Segundos a la vista necesarios según los minutos de lectura de la lección. */
  function segundosNecesarios(minutos) {
    const m = Number(minutos);
    const base = Math.round((m > 0 ? m : 1) * 60 * FRACCION);
    return Math.min(SEG_MAX, Math.max(SEG_MIN, base));
  }

  /**
   * ¿Se ha llegado al final del texto? `bottoms` son los bordes inferiores (px, respecto a la ventana)
   * de los bloques de texto de la lección; el final es el más bajo de todos.
   */
  function finalAlcanzado(bottoms, altoVentana, margen) {
    const v = (Array.isArray(bottoms) ? bottoms : []).filter(Number.isFinite);
    if (!v.length || !(altoVentana > 0)) return false;
    return Math.max.apply(null, v) <= altoVentana + (margen == null ? MARGEN_PX : margen);
  }

  /** Decisión: tiempo suficiente a la vista y final alcanzado. */
  function haLeido(o) {
    const x = o || {};
    return Number(x.segundos) >= segundosNecesarios(x.minutos) && finalAlcanzado(x.bottoms, x.altoVentana);
  }

  return { FRACCION, SEG_MIN, SEG_MAX, MARGEN_PX, segundosNecesarios, finalAlcanzado, haLeido };
});
