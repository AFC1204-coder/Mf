/**
 * Estado «reciente» entre dispositivos — la parte pura.
 * Lo que antes vivía solo en cada navegador (última lección leída, últimos libros, hilo de la noche)
 * se guarda también en Supabase (tabla estado_lectura). Cada campo lleva su propia marca de tiempo (ts)
 * y, al sincronizar, gana el más reciente: así el portátil y el móvil terminan con lo mismo sin
 * pisarse (si cambias el hilo en uno y el último libro en otro, se conservan los dos).
 *
 * UMD: window.Estado en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Estado = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CAMPOS = ['ultima', 'ultimos', 'hilo'];
  const MAX_ULTIMOS = 6;

  /** Marca de tiempo de un campo (0 si no hay dato). */
  const ts = campo => (campo && Number(campo.ts)) || 0;

  /**
   * Compara el estado local con la fila remota (puede ser null o venir incompleta).
   * Devuelve qué campos hay que bajar (el remoto es más nuevo) y cuáles subir (el local es más nuevo).
   * Con marcas iguales no se hace nada.
   */
  function comparar(local, remoto) {
    const l = local || {}, r = remoto || {};
    const bajar = [], subir = [];
    for (const c of CAMPOS) {
      const tl = ts(l[c]), tr = ts(r[c]);
      if (tr > tl) bajar.push(c);
      else if (tl > tr) subir.push(c);
    }
    return { bajar, subir };
  }

  /** Lista de ids de libros: solo textos, sin repetidos, como máximo MAX_ULTIMOS. */
  function normalizarUltimos(ids, max) {
    const n = max || MAX_ULTIMOS, vistos = new Set(), out = [];
    for (const id of Array.isArray(ids) ? ids : []) {
      if (typeof id !== 'string' || !id || vistos.has(id)) continue;
      vistos.add(id); out.push(id);
      if (out.length >= n) break;
    }
    return out;
  }

  /** Pone un libro el primero de los últimos (si ya estaba, lo sube). */
  function empujarUltimo(ids, id, max) {
    return normalizarUltimos([id].concat(Array.isArray(ids) ? ids : []), max);
  }

  /**
   * Marca de partida de un dato que existía antes de este sistema (no tiene ts): 1 si hay dato, 0 si no.
   * Así sube la primera vez si el servidor no tiene nada, pero cede ante cualquier cambio real posterior.
   */
  const marcaInicial = hayDato => (hayDato ? 1 : 0);

  return { CAMPOS, MAX_ULTIMOS, ts, comparar, normalizarUltimos, empujarUltimo, marcaInicial };
});
