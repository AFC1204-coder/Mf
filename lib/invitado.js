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
    'perfil_usuario', 'repaso', 'notificaciones', 'alertas_agente', 'mapeo_mercados'
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

  return { decidir, TABLAS_PERSONALES, RPC_LECTURA_PERSONAL, RPC_PERMITIDAS, TABLAS_ESCRITURA_PERMITIDA };
});
