/**
 * Audio de la lección con la pantalla apagada: la parte pura (sin DOM ni red).
 *  - metadatos para la pantalla de bloqueo (título, autor, libro, icono),
 *  - saltos de ±N segundos sin salirse del audio,
 *  - qué lecciones tienen audio grabado (`datos/audios.json`) y si esa grabación sigue diciendo lo que el texto,
 *  - un silencio mínimo para «desbloquear» la reproducción dentro del toque del usuario (iOS/Safari exigen
 *    que el primer play() ocurra en el gesto y aquí el audio se genera varios segundos después).
 *
 * UMD: window.AudioLeccion en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AudioLeccion = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SALTO_S = 15;

  /** Metadatos de la sesión multimedia (lo que se ve en la pantalla de bloqueo). */
  function metadata(lec, libro, iconos) {
    const txt = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return {
      title: txt(lec && lec.titulo) || 'Lección',
      artist: txt(libro && libro.autor) || 'Mente fría',
      album: txt(libro && libro.titulo) || 'Mente fría',
      artwork: (iconos || []).map(i => ({ src: i.src, sizes: i.sizes, type: i.type || 'image/png' })),
    };
  }

  /** Nueva posición tras saltar `delta` segundos, siempre dentro de [0, duración]. */
  function saltar(actual, duracion, delta) {
    const d = Number(duracion), a = Number(actual), x = Number(delta);
    if (!isFinite(a) || !isFinite(x)) return 0;
    const t = a + x;
    if (!isFinite(d) || d <= 0) return Math.max(0, t);
    return Math.min(d, Math.max(0, t));
  }

  /** Estado de posición válido para mediaSession.setPositionState, o null si el audio aún no tiene duración. */
  function posicion(duracion, actual, velocidad) {
    const d = Number(duracion), a = Number(actual);
    if (!isFinite(d) || d <= 0 || !isFinite(a)) return null;
    return { duration: d, position: Math.min(d, Math.max(0, a)), playbackRate: Number(velocidad) > 0 ? Number(velocidad) : 1 };
  }

  /** WAV mono de 8 kHz y 8 bits con silencio (por defecto 0,1 s). Devuelve los bytes. */
  function silencioWav(segundos) {
    const hz = 8000, n = Math.max(1, Math.round(hz * (segundos || 0.1)));
    const b = new Uint8Array(44 + n);
    const dv = new DataView(b.buffer);
    const ascii = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
    ascii(0, 'RIFF'); dv.setUint32(4, 36 + n, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, hz, true); dv.setUint32(28, hz, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
    ascii(36, 'data'); dv.setUint32(40, n, true);
    b.fill(128, 44);                                     // 8 bits sin signo: 128 = silencio
    return b;
  }

  const ID_LECCION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const HUELLA = /^[0-9a-f]{8}$/;

  /**
   * Huella del texto que se grabó: FNV-1a de 32 bits sobre título, cuerpo y matiz tal cual están en el corpus.
   * Es la misma cuenta que hace `tools/audio` al generar el audio.
   */
  function huella(lec) {
    const s = `${(lec && lec.titulo) || ''}\n${(lec && lec.cuerpo) || ''}\n${(lec && lec.autocorreccion) || ''}`;
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  /**
   * El audio grabado de una lección según `datos/audios.json`, o null si no lo hay o ya no vale.
   * No vale si el texto de la lección ha cambiado desde que se grabó: el audio diría otra cosa que lo que se lee.
   * Devuelve { url, clave, s }: `clave` identifica esa grabación concreta (sirve de clave de caché).
   */
  function grabado(indice, lec) {
    const e = indice && indice.lecciones && lec && typeof lec.id === 'string' && ID_LECCION.test(lec.id) ? indice.lecciones[lec.id] : null;
    if (!e || typeof e !== 'object' || !HUELLA.test(String(e.h || '')) || e.h !== huella(lec)) return null;
    const base = typeof indice.base === 'string' && /^(?:[a-z0-9_-]+\/)+$/i.test(indice.base) ? indice.base : 'audio/';
    const r = /^[0-9a-f]{1,12}$/.test(String(e.r || '')) ? e.r : '0';
    return { url: `${base}${lec.id.toLowerCase()}.mp3`, clave: `${lec.id}-g-${e.h}-${r}`, s: Number(e.s) > 0 ? Math.round(Number(e.s)) : 0 };
  }

  /** ¿Tiene esta lección audio grabado y vigente? */
  const tieneGrabado = (indice, lec) => grabado(indice, lec) !== null;

  return { SALTO_S, metadata, saltar, posicion, silencioWav, huella, grabado, tieneGrabado };
});
