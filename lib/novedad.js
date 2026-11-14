/**
 * «Nuevo» — un libro es nuevo durante los primeros días tras publicarse (fecha_creacion).
 * UMD: window.Novedad en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Novedad = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DIAS = 30;
  function esNuevo(fecha, ahora, dias) {
    const t = Date.parse(fecha);
    const a = ahora == null ? Date.now() : +ahora;
    if (!Number.isFinite(t) || t > a + 3600e3) return false;
    return a - t <= (dias || DIAS) * 86400e3;
  }
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  /** «5 nov 2026» (hora local) o '' si la fecha no es válida. */
  function fechaCorta(fecha) {
    const d = new Date(fecha);
    if (fecha == null || !Number.isFinite(d.getTime())) return '';
    return d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear();
  }
  return { esNuevo, fechaCorta, DIAS };
});
