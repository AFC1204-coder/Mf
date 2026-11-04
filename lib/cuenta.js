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
    if (t.includes('signups not allowed') || t.includes('user not found') || t.includes('user_not_found') || t.includes('signup_disabled')) return 'Ese correo no tiene cuenta en Mente fría.';
    if (t.includes('otp_expired') || t.includes('token has expired') || t.includes('expired or is invalid')) return 'El código o el enlace ha caducado o no es correcto. Pide uno nuevo.';
    if (t.includes('email_address_invalid') || t.includes('unable to validate email')) return 'Ese correo no parece válido.';
    if (status === 429 || t.includes('rate limit') || t.includes('over_request_rate_limit')) return 'Demasiados intentos. Espera un minuto y vuelve a probar.';
    if (t.includes('email not confirmed') || t.includes('email_not_confirmed')) return 'Falta confirmar el correo: revisa tu bandeja de entrada.';
    if (t.includes('invalid login') || t.includes('invalid_credentials') || t.includes('invalid_grant')) return 'Correo o contraseña incorrectos.';
    if (status >= 500) return 'El servidor no responde ahora. Inténtalo en un rato.';
    return 'No se pudo entrar. Revisa los datos e inténtalo de nuevo.';
  }

  /** Solo el correo (para pedir enlace o código, sin contraseña). null si está bien. */
  function validarCorreo(email) {
    const e = String(email || '').trim();
    if (!e) return 'Escribe tu correo.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Ese correo no parece válido.';
    return null;
  }

  /** Código del correo: solo cifras, entre 6 y 10 (Supabase usa 6 por defecto). Devuelve el código limpio o null. */
  function limpiarCodigo(texto) {
    const c = String(texto || '').replace(/[\s-]/g, '');
    return /^\d{6,10}$/.test(c) ? c : null;
  }

  /**
   * Lo que trae el enlace del correo al volver a la app: Supabase añade a la dirección
   * #access_token=…&refresh_token=…&expires_in=…&type=magiclink (o #error=…&error_code=otp_expired…).
   * Devuelve { sesion, tipo }, { error } o null si el hash no tiene nada que ver (p. ej. #home).
   */
  function sesionDeHash(hash, ahora) {
    const h = String(hash || '').replace(/^#/, '');
    if (!h || h.indexOf('=') < 0) return null;
    let p;
    try { p = new URLSearchParams(h); } catch (e) { return null; }
    if (p.get('access_token')) {
      const ea = Number(p.get('expires_at'));
      const sesion = sesionDe({
        access_token: p.get('access_token'),
        refresh_token: p.get('refresh_token') || '',
        expires_in: Number(p.get('expires_in')) || 3600,
        expires_at: ea > 0 ? ea : undefined,
      }, ahora);
      return sesion ? { sesion, tipo: p.get('type') || '' } : null;
    }
    if (p.get('error') || p.get('error_code')) {
      const code = p.get('error_code') || p.get('error') || '';
      const desc = p.get('error_description') || '';
      return { error: mensajeError(400, code + ' ' + desc), codigo: code };
    }
    return null;
  }

  /** Un refresh token rechazado (400/401) significa que la sesión ya no vale; un fallo de red, no. */
  const sesionPerdida = status => status === 400 || status === 401 || status === 403;

  /** Identificador del usuario (`sub`) dentro de un token de acceso, o '' si no se puede leer. */
  function uidDeToken(token) {
    try {
      const parte = String(token || '').split('.')[1];
      if (!parte) return '';
      const b64 = parte.replace(/-/g, '+').replace(/_/g, '/');
      const json = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
      const sub = JSON.parse(decodeURIComponent(escape(json))).sub;
      return typeof sub === 'string' ? sub : '';
    } catch (e) { return ''; }
  }

  /**
   * A qué usuario pertenecen los datos personales en este dispositivo: el que la base de datos dijo en el último
   * inicio de sesión de ESTA cuenta (`cache = { uid, usuario }`); sin sesión o sin dato fiable, el de siempre ('default').
   */
  function usuarioDe(sesion, cache) {
    if (!sesion || !cache || typeof cache.usuario !== 'string' || !cache.usuario) return 'default';
    const uid = sesion.uid || uidDeToken(sesion.access);
    return uid && cache.uid === uid ? cache.usuario : 'default';
  }

  return { MARGEN_MS, uidDeToken, usuarioDe, sesionDe, vigente, hayQueRenovar, renovarEn, cabeceras, validarEntrada, validarCorreo, limpiarCodigo, sesionDeHash, mensajeError, sesionPerdida };
});
