/**
 * Vídeos de las lecciones: la parte pura (sin DOM ni red).
 *
 * Los vídeos están en YouTube; `datos/videos.json` dice qué lección y qué libro tienen cuál (lo escribe
 * `tools/video`, orden `publicados`). Aquí se lee ese índice con desconfianza —un identificador que no tenga
 * la forma de los de YouTube no llega nunca a una dirección— y se prepara lo que la pantalla necesita.
 *
 * UMD: window.VideoLeccion en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VideoLeccion = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ID = /^[A-Za-z0-9_-]{11}$/;
  /** Lo que se ofrece dentro de la app y en qué orden. Las piezas de pregunta, práctica y caso son para redes. */
  const EN_LECCION = [
    { tipo: 'idea', etiqueta: 'Ver en vídeo' },
    { tipo: 'fondo', etiqueta: 'Versión larga' },
  ];
  const EN_LIBRO = [{ tipo: 'libro', etiqueta: 'El libro en vídeo' }];

  const idValido = id => typeof id === 'string' && ID.test(id);

  /** «45 s», «2 min», «5 min»: la duración como se dice, no como un cronómetro. */
  function duracion(s) {
    const n = Math.round(Number(s));
    if (!isFinite(n) || n <= 0) return '';
    return n < 60 ? `${n} s` : `${Math.max(1, Math.round(n / 60))} min`;
  }

  function lista(entrada, orden) {
    if (!entrada || typeof entrada !== 'object') return [];
    return orden
      .map(o => {
        const e = entrada[o.tipo];
        return e && idValido(e.yt) ? { tipo: o.tipo, etiqueta: o.etiqueta, yt: e.yt, duracion: duracion(e.s) } : null;
      })
      .filter(Boolean);
  }

  /** Los vídeos de una lección, listos para pintar: [{tipo, etiqueta, yt, duracion}]. Vacío si no tiene. */
  function deLeccion(indice, leccionId) {
    const l = indice && indice.lecciones;
    return lista(l && leccionId != null ? l[leccionId] : null, EN_LECCION);
  }

  /** El vídeo de presentación de un libro (misma forma que deLeccion). */
  function deLibro(indice, libroId) {
    const l = indice && indice.libros;
    return lista(l && libroId != null ? l[libroId] : null, EN_LIBRO);
  }

  /** ¿Tiene esta lección algún vídeo que se ofrezca en la app? */
  const tiene = (indice, leccionId) => deLeccion(indice, leccionId).length > 0;

  /** Dirección del reproductor incrustado (dominio sin cookies de YouTube). Cadena vacía si el identificador no vale. */
  function urlIncrustar(yt) {
    return idValido(yt) ? `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&playsinline=1&rel=0` : '';
  }

  /** Miniatura que publica YouTube para el vídeo. */
  function urlMiniatura(yt) {
    return idValido(yt) ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : '';
  }

  /** Enlace para abrir o compartir el vídeo fuera de la app. */
  function urlVer(yt) {
    return idValido(yt) ? `https://www.youtube.com/watch?v=${yt}` : '';
  }

  return { deLeccion, deLibro, tiene, duracion, idValido, urlIncrustar, urlMiniatura, urlVer };
});
