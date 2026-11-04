/**
 * Deslizar entre las pantallas principales (móvil): Hoy · Biblioteca · Consulta · Repaso · Tú.
 * Lógica pura (decidir si un gesto es un cambio de pantalla y a cuál); el DOM vive en swipe-ui.js.
 *
 * UMD: window.Swipe en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Swipe = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ORDEN = ['home', 'biblioteca', 'consulta', 'repaso-srs', 'tu'];
  const MIN_DX = 70;        // recorrido horizontal mínimo (px)
  const RATIO = 1.8;        // el gesto debe ser claramente más horizontal que vertical
  const MAX_MS = 900;       // un arrastre lento no es un deslizamiento
  const BORDE = 24;         // el borde de la pantalla es del gesto «atrás» del sistema

  function vecino(vista, dir) {
    const i = ORDEN.indexOf(vista);
    if (i < 0) return null;
    const j = i + (dir === 'sig' ? 1 : -1);
    return ORDEN[j] || null;
  }

  /**
   * g = { dx, dy, ms, x0, ancho, vista, ignorado }
   * Devuelve { dir: 'sig'|'ant', destino } o null si el gesto no es un cambio de pantalla.
   * Deslizar hacia la izquierda (dx < 0) lleva a la siguiente; hacia la derecha, a la anterior.
   */
  function decidir(g) {
    if (!g || g.ignorado) return null;
    if (ORDEN.indexOf(g.vista) < 0) return null;
    const dx = Number(g.dx), dy = Number(g.dy), ms = Number(g.ms);
    if (!isFinite(dx) || !isFinite(dy) || !isFinite(ms)) return null;
    if (ms > MAX_MS) return null;
    if (Math.abs(dx) < MIN_DX) return null;
    if (Math.abs(dx) < Math.abs(dy) * RATIO) return null;
    if (g.ancho > 0 && (g.x0 < BORDE || g.x0 > g.ancho - BORDE)) return null;
    const dir = dx < 0 ? 'sig' : 'ant';
    const destino = vecino(g.vista, dir);
    return destino ? { dir, destino } : null;
  }

  return { ORDEN, MIN_DX, RATIO, MAX_MS, BORDE, vecino, decidir };
});
