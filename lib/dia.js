/**
 * Día lógico — el día de lectura no acaba a medianoche sino a las 04:00.
 * Leer a las 00:30 cuenta como «esta noche», no como mañana.
 *
 * UMD: window.Dia en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dia = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CORTE_HORA = 4;

  const iso = o => `${o.getFullYear()}-${String(o.getMonth() + 1).padStart(2, '0')}-${String(o.getDate()).padStart(2, '0')}`;

  /** YYYY-MM-DD local del día lógico al que pertenece `fecha` (Date, ISO o ms). */
  function logico(fecha, corte) {
    const c = corte == null ? CORTE_HORA : corte;
    const d = fecha instanceof Date ? new Date(fecha.getTime()) : new Date(fecha);
    if (isNaN(d)) return null;
    d.setHours(d.getHours() - c);
    return iso(d);
  }

  function hoy(corte, ahora) {
    return logico(ahora || new Date(), corte);
  }

  /** Día anterior a un YYYY-MM-DD. */
  function anterior(dia) {
    const d = new Date(dia + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return iso(d);
  }

  /** Conjunto de días lógicos con actividad a partir de fechas sueltas. */
  function dias(fechas, corte) {
    const s = new Set();
    (fechas || []).forEach(f => { if (f) { const k = logico(f, corte); if (k) s.add(k); } });
    return s;
  }

  /**
   * Días seguidos con actividad terminando hoy o ayer
   * (hoy todavía no está perdido mientras no acabe).
   */
  function racha(fechas, hoyDia, corte) {
    const s = dias(fechas, corte);
    if (!s.size) return 0;
    let cur = hoyDia || hoy(corte);
    if (!s.has(cur)) cur = anterior(cur);
    let n = 0;
    while (s.has(cur)) { n++; cur = anterior(cur); }
    return n;
  }

  /** Días con actividad en el mes (YYYY-MM) del día dado. */
  function diasDelMes(fechas, hoyDia, corte) {
    const mes = (hoyDia || hoy(corte)).slice(0, 7);
    let n = 0;
    dias(fechas, corte).forEach(d => { if (d.slice(0, 7) === mes) n++; });
    return n;
  }

  return { CORTE_HORA, logico, hoy, anterior, dias, racha, diasDelMes };
});
