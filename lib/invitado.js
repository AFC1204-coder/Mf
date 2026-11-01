/**
 * Modo invitado — la parte pura. Quien abre un enlace compartido (?carta=1) entra en SOLO LECTURA:
 *  - no recibe nada personal del dueño (progreso, favoritos, notas, subrayados, repaso, perfil…),
 *  - no escribe nada (ni en tablas personales ni en datos compartidos),
 *  - la única excepción es avisar de un fallo («¿Algo no cuadra?»).
 * Toda la comunicación con la base de datos pasa por `decidir`, así hay un único punto de control.
 *
 * UMD: window.Invitado en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Invitado = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Tablas con datos del dueño: el invitado ni las lee ni las escribe. */
  const TABLAS_PERSONALES = [
    'progreso', 'favoritos_usuario', 'notas', 'subrayados', 'sesiones', 'compromisos', 'eventos',
    'perfil_usuario', 'repaso', 'notificaciones', 'alertas_agente', 'mapeo_mercados', 'estado_lectura'
  ];
  /** Funciones (rpc) que leen el repaso o el estado del dueño. */
  const RPC_LECTURA_PERSONAL = ['obtener_cola_repaso', 'estado_repaso', 'check_repaso_pendiente'];
  /** Funciones que sí puede usar el invitado (solo leen contenido). */
  const RPC_PERMITIDAS = ['buscar_corpus'];
  /** Única tabla en la que puede escribir (y solo añadir, nunca cambiar ni borrar). */
  const TABLAS_ESCRITURA_PERMITIDA = ['reportes_contenido'];

  const tabla = path => String(path || '').split('?')[0].replace(/^\/+/, '').toLowerCase();

  /**
   * ¿Qué hacer con una petición?
   *   'pasar'     → se envía tal cual
   *   'vacio'     → no se envía; la lectura devuelve «sin datos»
   *   'descartar' → no se envía; la escritura se ignora en silencio
   */
  function decidir(path, method, invitado) {
    if (!invitado) return 'pasar';
    const m = String(method || 'GET').toUpperCase();
    const t = tabla(path);
    const esRpc = t.startsWith('rpc/');
    const nombre = esRpc ? t.slice(4) : t;
    if (esRpc) {
      if (RPC_LECTURA_PERSONAL.includes(nombre)) return 'vacio';
      if (RPC_PERMITIDAS.includes(nombre)) return 'pasar';
      return 'descartar';
    }
    if (TABLAS_PERSONALES.includes(nombre)) return m === 'GET' || m === 'HEAD' ? 'vacio' : 'descartar';
    if (m === 'GET' || m === 'HEAD') return 'pasar';
    return m === 'POST' && TABLAS_ESCRITURA_PERMITIDA.includes(nombre) ? 'pasar' : 'descartar';
  }

  /** Hasta `n` ideas del libro, de lecciones distintas: idea_clave y, si falta, la idea memorable. */
  function ideasDelLibro(lecciones, n) {
    const out = [];
    const orden = [...(lecciones || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    for (const l of orden) {
      const t = String(l.idea_clave || l.cita_memorable || '').replace(/\s+/g, ' ').trim();
      if (t && !out.includes(t)) out.push(t);
      if (out.length >= (n || 3)) break;
    }
    return out;
  }

  /** Texto que acompaña al enlace al compartir un libro: una idea que enganche y lo que se va a encontrar. */
  function textoCompartirLibro(libro, ideas, nLecciones, minutos) {
    const gancho = ideas && ideas[0] ? '«' + ideas[0] + '»' : '';
    const dato = nLecciones ? nLecciones + ' lecciones · ' + (minutos < 60 ? minutos + ' min' : Math.round(minutos / 6) / 10 + ' h') + ' de lectura' : '';
    return [gancho, libro.titulo + ' — ' + libro.autor, dato].filter(Boolean).join('\n');
  }

  return { decidir, ideasDelLibro, textoCompartirLibro, TABLAS_PERSONALES, RPC_LECTURA_PERSONAL, RPC_PERMITIDAS, TABLAS_ESCRITURA_PERMITIDA };
});
