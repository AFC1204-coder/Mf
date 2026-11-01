/**
 * Cuenta (inicio de sesión con correo y contraseña) — la parte pura.
 * La app habla con Supabase Auth (GoTrue) por REST; aquí solo están las decisiones sin red ni DOM:
 * qué se guarda de una sesión, cuándo hay que renovarla, qué cabeceras llevan las peticiones y qué
 * mensaje se enseña ante cada error.
 *
 * UMD: window.CuentaLib en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CuentaLib = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Margen para renovar antes de que caduque (el token dura ~1 h). */
  const MARGEN_MS = 120 * 1000;

  /** De la respuesta de Supabase Auth a lo que se guarda. null si no trae lo necesario. */
  function sesionDe(resp, ahora) {
    if (!resp || typeof resp.access_token !== 'string' || !resp.access_token) return null;
    const expira = resp.expires_at
      ? Number(resp.expires_at) * 1000
      : (Number(ahora) || 0) + (Number(resp.expires_in) || 3600) * 1000;
    return {
      access: resp.access_token,
      refresh: typeof resp.refresh_token === 'string' ? resp.refresh_token : '',
      expira,
      email: (resp.user && resp.user.email) || '',
      uid: (resp.user && resp.user.id) || '',
    };
  }

  /** ¿Sirve el token de acceso todavía (con margen)? */
  function vigente(sesion, ahora, margen) {
    if (!sesion || !sesion.access) return false;
    return Number(sesion.expira) - (margen == null ? MARGEN_MS : margen) > Number(ahora);
  }

  /** ¿Hay que pedir un token nuevo? Solo si hay con qué renovarlo. */
  function hayQueRenovar(sesion, ahora) {
    return !!(sesion && sesion.refresh) && !vigente(sesion, ahora);
  }

  /** Milisegundos hasta el momento de renovar (nunca menos de 5 s). */
  function renovarEn(sesion, ahora) {
    if (!sesion) return 0;
    return Math.max(5000, Number(sesion.expira) - MARGEN_MS - Number(ahora));
  }

  /** Cabeceras de una petición a la API: el token del usuario si sirve, y si no la clave pública. */
  function cabeceras(sesion, ahora, claveAnon, extra) {
    const bearer = vigente(sesion, ahora, 0) ? sesion.access : claveAnon;
    return Object.assign({ apikey: claveAnon, Authorization: 'Bearer ' + bearer }, extra || {});
  }

  /** Comprueba lo escrito antes de llamar a la red. Devuelve el mensaje, o null si está bien. */
  function validarEntrada(email, pass) {
    const e = String(email || '').trim();
    if (!e) return 'Escribe tu correo.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Ese correo no parece válido.';
    if (!pass) return 'Escribe tu contraseña.';
    return null;
  }

  /** Mensaje para el usuario según lo que contestó Supabase Auth (status HTTP y cuerpo). */
  function mensajeError(status, cuerpo) {
    const t = (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo || {})).toLowerCase();
    if (status === 0) return 'No hay conexión. Inténtalo de nuevo.';
    if (status === 429 || t.includes('rate limit') || t.includes('over_request_rate_limit')) return 'Demasiados intentos. Espera un minuto y vuelve a probar.';
    if (t.includes('email not confirmed') || t.includes('email_not_confirmed')) return 'Falta confirmar el correo: revisa tu bandeja de entrada.';
    if (t.includes('invalid login') || t.includes('invalid_credentials') || t.includes('invalid_grant')) return 'Correo o contraseña incorrectos.';
    if (status >= 500) return 'El servidor no responde ahora. Inténtalo en un rato.';
    return 'No se pudo entrar. Revisa los datos e inténtalo de nuevo.';
  }

  /** Un refresh token rechazado (400/401) significa que la sesión ya no vale; un fallo de red, no. */
  const sesionPerdida = status => status === 400 || status === 401 || status === 403;

  return { MARGEN_MS, sesionDe, vigente, hayQueRenovar, renovarEn, cabeceras, validarEntrada, mensajeError, sesionPerdida };
});
