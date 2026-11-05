/**
 * Tarjeta de una idea para compartir (imagen 1080×1350): la parte pura, sin DOM ni canvas.
 * Reglas de exactitud: el texto es SIEMPRE el de la lección, nunca reescrito: la idea clave tal cual (o, si no hay,
 * la idea redactada o el arranque del cuerpo); solo se recorta por frases enteras y, si una sola frase no cabe,
 * por palabras con «…». Que el texto nunca se desborde lo garantiza `plan()`, con pruebas.
 *
 * UMD: window.Tarjeta en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Tarjeta = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const W = 1080, H = 1350, MARGEN = 96, ANCHO = W - 2 * MARGEN;
  const TOP = 330, PIE_TOP = H - 230;               // zona de contenido: de la etiqueta al pie con libro y enlace
  const FUENTES = [64, 58, 52, 47, 43, 39, 36];     // tamaños de la idea, del mayor al menor
  const INTERLINEA = 1.3;
  const FUENTE_MATIZ = 30, INTERLINEA_MATIZ = 1.4, MATIZ_MAX = 260;
  const ALTO_ESQUEMA = 380;

  const limpiar = s => String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/[#>*_`]/g, '').replace(/\s+/g, ' ').trim();

  /** Frases de un texto (conserva el signo final). */
  function frases(t) { return (t.match(/[^.!?…]+(?:[.!?…]+|$)/g) || [t]).map(f => f.trim()).filter(Boolean); }

  /** Primeras frases enteras hasta `max` caracteres; si ni una cabe, recorta por palabras con «…». */
  function extracto(txt, max) {
    const t = limpiar(txt);
    if (t.length <= max) return t;
    let out = '';
    for (const f of frases(t)) { const c = out ? out + ' ' + f : f; if (c.length > max) break; out = c; }
    if (out) return out;
    const corte = t.slice(0, max - 1).replace(/\s+\S*$/, '');
    return (corte || t.slice(0, max - 1)) + '…';
  }

  /** Qué texto lleva la tarjeta y de dónde sale (para no inventar nada). */
  function textoDeIdea(lec) {
    const ic = limpiar(lec && lec.idea_clave);
    if (ic.length >= 20) return { texto: ic, origen: 'idea_clave' };
    const cm = limpiar(lec && lec.cita_memorable);
    if (cm.length >= 20) return { texto: cm, origen: 'cita_memorable' };
    const cu = extracto(lec && lec.cuerpo, 220);
    return cu ? { texto: cu, origen: 'cuerpo' } : { texto: '', origen: '' };
  }

  /** El matiz: primeras frases de la autocorrección, hasta `max` caracteres. '' si no hay. */
  function matiz(lec, max) { return extracto(lec && lec.autocorreccion, max || MATIZ_MAX); }

  /**
   * Parte el texto en líneas que caben en `ancho` según `medir(texto, tamaño)`.
   * Devuelve { lineas, recortado }. Si hay más de `maxLineas`, quita frases del final y, si una sola frase no cabe, corta por palabras con «…».
   */
  function envolver(texto, medir, tam, ancho, maxLineas) {
    const partir = t => {
      const out = []; let linea = '';
      for (const w of t.split(' ')) {
        const prueba = linea ? linea + ' ' + w : w;
        if (linea && medir(prueba, tam) > ancho) { out.push(linea); linea = w; } else linea = prueba;
      }
      if (linea) out.push(linea);
      return out;
    };
    let t = limpiar(texto);
    let lineas = partir(t), recortado = false;
    if (lineas.length <= maxLineas) return { lineas, recortado };
    recortado = true;
    const fs = frases(t);
    while (fs.length > 1) {
      fs.pop();
      lineas = partir(fs.join(' '));
      if (lineas.length <= maxLineas) return { lineas, recortado };
    }
    // una sola frase que no cabe: corta por palabras y cierra con «…»
    const pal = fs[0].split(' ');
    while (pal.length > 1) {
      pal.pop();
      lineas = partir(pal.join(' ').replace(/[,;:—–-]+$/, '') + '…');
      if (lineas.length <= maxLineas) return { lineas, recortado };
    }
    return { lineas: [pal[0] || ''], recortado };
  }

  /**
   * Diseño de la tarjeta. opciones: { matiz: bool, esquema: bool }. medir(texto, tamaño) → px.
   * Devuelve las líneas de la idea y del matiz, los tamaños y las alturas, y `cabe` (siempre true: el plan se
   * ajusta hasta que cabe; si no hay forma, recorta).
   */
  function plan(lec, opc, medir) {
    opc = opc || {};
    const { texto, origen } = textoDeIdea(lec);
    let lineasMatiz = [], altoMatiz = 0;
    if (opc.matiz) {
      const m = matiz(lec, MATIZ_MAX);
      if (m) {
        lineasMatiz = envolver(m, medir, FUENTE_MATIZ, ANCHO, 5).lineas;
        altoMatiz = 100 + lineasMatiz.length * FUENTE_MATIZ * INTERLINEA_MATIZ;    // regla + etiqueta + líneas + aire
      }
    }
    const altoEsquema = opc.esquema ? ALTO_ESQUEMA + 40 : 0;
    const disponible = PIE_TOP - TOP - 40 - altoMatiz - altoEsquema;
    let elegido = null;
    for (const fs of FUENTES) {
      const max = Math.floor(disponible / (fs * INTERLINEA));
      if (max < 1) continue;
      const r = envolver(texto, medir, fs, ANCHO, max);
      if (!r.recortado) { elegido = { fs, ...r }; break; }
      if (!elegido) elegido = { fs, ...r };                  // el menor recorte posible con el mayor tamaño que lo logra
    }
    if (!elegido) {
      const fs = FUENTES[FUENTES.length - 1];
      elegido = { fs, ...envolver(texto, medir, fs, ANCHO, Math.max(1, Math.floor(disponible / (fs * INTERLINEA)))) };
    }
    // Si todos los tamaños recortaron, se queda con el menor tamaño (el que menos recorta)
    if (elegido.recortado) {
      const fs = FUENTES[FUENTES.length - 1];
      const max = Math.max(1, Math.floor(disponible / (fs * INTERLINEA)));
      const r = envolver(texto, medir, fs, ANCHO, max);
      elegido = { fs, ...r };
    }
    return {
      W, H, MARGEN, ANCHO, TOP, PIE_TOP, ALTO_ESQUEMA,
      origen, texto,
      idea: { lineas: elegido.lineas, fs: elegido.fs, interlinea: INTERLINEA, recortado: elegido.recortado },
      matiz: { lineas: lineasMatiz, fs: FUENTE_MATIZ, interlinea: INTERLINEA_MATIZ, alto: altoMatiz },
      esquema: !!opc.esquema,
      altoIdea: elegido.lineas.length * elegido.fs * INTERLINEA,
      disponible,
    };
  }

  /** Nombre de archivo seguro para la imagen. */
  function nombreArchivo(lec) {
    const t = limpiar(lec && lec.titulo).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
    return 'idea-' + (t || 'mente-fria') + '.png';
  }

  return { W, H, MARGEN, ANCHO, TOP, PIE_TOP, ALTO_ESQUEMA, MATIZ_MAX, FUENTES, INTERLINEA, limpiar, frases, extracto, textoDeIdea, matiz, envolver, plan, nombreArchivo };
});
