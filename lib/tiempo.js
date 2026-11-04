/**
 * Tiempo real de lectura — cuánto tiempo pasa una lección a la vista.
 * Lógica pura (sin red ni DOM). Un segundo cuenta solo si: la lección está en pantalla, la pestaña es visible
 * y ha habido interacción (toque, desplazamiento, tecla) en los últimos 90 s; así un móvil olvidado con la
 * lección abierta no suma horas. Se guarda el total acumulado por lección y día lógico.
 * Diseño: docs/estudio-uso.md
 *
 * UMD: window.Tiempo en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Tiempo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const IDLE_MS = 90000;           // sin interacción más de esto: no cuenta
  const MAX_DIA = 6 * 3600;        // tope por lección y día (6 h): una cifra mayor es un error, no estudio

  const clave = (lecId, dia) => lecId + '|' + dia;

  /** ¿Cuenta este segundo? */
  function cuenta(o) {
    if (!o || !o.enLeccion || !o.leccionId || !o.visible) return false;
    const ult = Number(o.ultimaInteraccion);
    if (!Number.isFinite(ult)) return false;
    const d = Number(o.ahora) - ult;
    return d >= 0 && d <= IDLE_MS;
  }

  /** Suma un segundo a la lección del día, sin pasar del tope. Devuelve true si cambió. */
  function sumar(mapa, lecId, dia) {
    const k = clave(lecId, dia), v = mapa.get(k) || 0;
    if (v >= MAX_DIA) return false;
    mapa.set(k, v + 1);
    return true;
  }

  /** Filas para guardar de las claves modificadas (valor absoluto del día). */
  function filas(mapa, sucias, usuario) {
    const out = [];
    sucias.forEach(k => {
      const [leccion_id, dia] = k.split('|');
      const segundos = Math.min(MAX_DIA, Math.max(0, Math.round(mapa.get(k) || 0)));
      if (leccion_id && dia && segundos > 0) out.push({ usuario_id: usuario || 'default', leccion_id, dia, segundos });
    });
    return out;
  }

  /** Mapa a partir de las filas guardadas (al abrir la app), quedándose con el mayor si hay repetidas. */
  function deFilas(rows) {
    const m = new Map();
    (rows || []).forEach(r => {
      if (!r || !r.leccion_id || !r.dia) return;
      const k = clave(r.leccion_id, String(r.dia).slice(0, 10)), v = Number(r.segundos) || 0;
      if (v > (m.get(k) || 0)) m.set(k, v);
    });
    return m;
  }

  /** «1 h 05 min», «12 min», «45 s»; vacío si no hay nada. */
  function texto(seg) {
    const s = Math.round(Number(seg) || 0);
    if (s <= 0) return '0 min';
    if (s < 60) return s + ' s';
    const m = Math.round(s / 60);
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60), r = m % 60;
    return h + ' h' + (r ? ' ' + String(r).padStart(2, '0') + ' min' : '');
  }

  return { IDLE_MS, MAX_DIA, clave, cuenta, sumar, filas, deFilas, texto };
});
