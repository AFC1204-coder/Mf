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
  return { esNuevo, DIAS };
});
