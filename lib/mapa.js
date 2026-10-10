/**
 * Mapa visual de un libro como SVG propio: título, 4–6 ideas numeradas con icono y un cierre.
 * A diferencia de una imagen generada, el texto es EXACTO (sin erratas), siempre legible en móvil,
 * pesa unos 6–9 KB, se escala sin perder nitidez y es editable.
 *
 * El contenido (la «especificación») lo escribe una persona o un modelo; este módulo solo valida y dibuja.
 *
 * UMD: window.Mapa en el navegador, module.exports en Node y tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Mapa = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const W = 640;                 // ancho del lienzo; a 350 px de pantalla, 1 unidad ≈ 0,55 px
  const MIN_FUENTE = 20;         // ≈ 11 px en móvil
  const SERIF = "Georgia, 'Times New Roman', serif";
  const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

  /** Iconos de línea sobre rejilla 24×24. */
  const ICONOS = {
    bombilla: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.8 10.6c.8.7 1.3 1.5 1.3 2.4h5c0-.9.5-1.7 1.3-2.4A6 6 0 0 0 12 3z"/>',
    diana: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    ojo: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    balanza: '<path d="M12 3v18M6 21h12M5 7h14M5 7l-3 7a3 3 0 0 0 6 0L5 7zM19 7l-3 7a3 3 0 0 0 6 0l-3-7z"/>',
    dado: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="15.5" cy="15.5" r="1"/>',
    ciclo: '<path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5"/>',
    red: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="9" cy="18" r="2.5"/><path d="M8.2 7l7.6.7M7.3 8.2l1.2 7.3M16.6 10l-6 6.6"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    escudo: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>',
    brujula: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z"/>',
    libro: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 1 2-2h13"/>',
    grupo: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 14.2c3 0 6 1.6 6 5.8"/>',
    grafico: '<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>',
    pregunta: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.7M12 17h.01"/>',
    bandera: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    lupa: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>',
    llave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
    camino: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 17V9a4 4 0 0 1 4-4h6"/>'
  };

  const ACENTOS = {
    'Psicología y Conducta': '#c9a84c',
    'Pensamiento y Civilización': '#7aa2d6',
    'Economía y Mercados': '#6fb38a',
    'Neurociencia y Biología': '#c18ad1',
    'Desarrollo Humano': '#d98f5c'
  };

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const limpiar = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const nPal = s => limpiar(s).split(' ').filter(Boolean).length;

  /** Reparte un texto en líneas de como mucho `maxCar` caracteres sin cortar palabras. */
  function envolver(texto, maxCar) {
    const out = [];
    let cur = '';
    limpiar(texto).split(' ').filter(Boolean).forEach(p => {
      if (!cur) cur = p;
      else if ((cur + ' ' + p).length <= maxCar) cur += ' ' + p;
      else { out.push(cur); cur = p; }
    });
    if (cur) out.push(cur);
    return out;
  }

  /** Eje y subeje en una línea; si no cabe en el lienzo se queda solo el eje. */
  function cabecera(e) {
    const eje = limpiar(e.eje), sub = limpiar(e.subeje);
    const junto = eje && sub ? eje + ' · ' + sub : (eje || sub);
    return junto.length <= 34 ? junto : (eje || sub);
  }

  /** Errores de una especificación (lista vacía = válida). */
  function validar(e) {
    const err = [];
    if (!e || typeof e !== 'object') return ['Falta la especificación'];
    if (!limpiar(e.titulo)) err.push('Falta el título');
    if (!Array.isArray(e.nodos) || e.nodos.length < 3 || e.nodos.length > 6) err.push('Debe haber entre 3 y 6 nodos');
    (e.nodos || []).forEach((n, i) => {
      const k = `Nodo ${i + 1}`;
      if (!limpiar(n && n.etiqueta)) err.push(`${k}: falta la etiqueta`);
      else if (nPal(n.etiqueta) > 5) err.push(`${k}: la etiqueta pasa de 5 palabras`);
      if (n && n.texto && nPal(n.texto) > 12) err.push(`${k}: el texto pasa de 12 palabras`);
      if (!n || !ICONOS[n.icono]) err.push(`${k}: icono desconocido (${n && n.icono})`);
    });
    if (e.cierre && nPal(e.cierre) > 22) err.push('El cierre pasa de 22 palabras');
    return err;
  }

  /** Dibuja la especificación como SVG. Lanza si no es válida. */
  function svg(e) {
    const err = validar(e);
    if (err.length) throw new Error('Especificación no válida: ' + err.join('; '));
    const acento = e.acento || ACENTOS[e.eje] || '#c9a84c';
    const partes = [];
    let y = 60;

    // Cabecera
    if (limpiar(e.eje || e.subeje)) {
      partes.push(`<text x="48" y="${y}" font-family="${SANS}" font-size="${MIN_FUENTE}" letter-spacing="3" fill="${acento}">${esc(cabecera(e).toUpperCase())}</text>`);
      y += 28;
    }
    const lt = envolver(e.titulo, 22);
    lt.forEach((l, i) => { y += 52; partes.push(`<text x="48" y="${y}" font-family="${SERIF}" font-size="46" font-weight="700" fill="#f1ede4">${esc(l)}</text>`); });
    if (limpiar(e.autor)) { y += 40; partes.push(`<text x="48" y="${y}" font-family="${SERIF}" font-size="26" font-style="italic" fill="#9aa4b2">${esc(e.autor)}</text>`); }
    y += 36;
    partes.push(`<rect x="48" y="${y}" width="64" height="3" rx="1.5" fill="${acento}"/>`);
    y += 40;

    // Nodos
    const xr = 64, xc = 112, wc = W - xc - 28, topeLineas = 2;
    const tarjetas = [];
    e.nodos.forEach((n, i) => {
      const lab = envolver(n.etiqueta, 22).slice(0, 2);
      const tex = n.texto ? envolver(n.texto, 31).slice(0, topeLineas) : [];
      const h = Math.max(104, 30 + lab.length * 34 + (tex.length ? 8 + tex.length * 28 : 0) + 22);
      tarjetas.push({ n, lab, tex, h, y });
      y += h + 26;
    });
    const yPrimero = tarjetas[0].y + tarjetas[0].h / 2;
    const yUltimo = tarjetas[tarjetas.length - 1].y + tarjetas[tarjetas.length - 1].h / 2;
    partes.push(`<line x1="${xr}" y1="${yPrimero}" x2="${xr}" y2="${yUltimo}" stroke="${acento}" stroke-opacity="0.35" stroke-width="2" stroke-dasharray="3 7" stroke-linecap="round"/>`);

    tarjetas.forEach((t, i) => {
      const cy = t.y + t.h / 2;
      partes.push(`<circle cx="${xr}" cy="${cy}" r="26" fill="#0d1117" stroke="${acento}" stroke-width="2.5"/>`);
      partes.push(`<text x="${xr}" y="${cy + 9}" text-anchor="middle" font-family="${SERIF}" font-size="26" font-weight="700" fill="${acento}">${i + 1}</text>`);
      partes.push(`<rect x="${xc}" y="${t.y}" width="${wc}" height="${t.h}" rx="16" fill="#151c26" stroke="#263142" stroke-width="1.5"/>`);
      partes.push(`<rect x="${xc}" y="${t.y + 18}" width="4" height="${t.h - 36}" rx="2" fill="${acento}"/>`);
      partes.push(`<circle cx="${xc + 50}" cy="${cy}" r="30" fill="${acento}" fill-opacity="0.12"/>`);
      partes.push(`<g transform="translate(${xc + 50 - 18},${cy - 18}) scale(1.5)" fill="none" stroke="${acento}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONOS[t.n.icono]}</g>`);
      let ty = t.y + 20 + 28;
      t.lab.forEach(l => { partes.push(`<text x="${xc + 96}" y="${ty}" font-family="${SANS}" font-size="28" font-weight="700" fill="#f1ede4">${esc(l)}</text>`); ty += 34; });
      if (t.tex.length) { t.tex.forEach(l => { partes.push(`<text x="${xc + 96}" y="${ty}" font-family="${SANS}" font-size="22" fill="#a9b3c1">${esc(l)}</text>`); ty += 28; }); }
    });

    // Cierre
    if (limpiar(e.cierre)) {
      const lc = envolver(e.cierre, 30).slice(0, 4);
      const h = 66 + lc.length * 36;
      partes.push(`<rect x="48" y="${y}" width="${W - 96}" height="${h}" rx="18" fill="${acento}" fill-opacity="0.10" stroke="${acento}" stroke-opacity="0.55" stroke-width="1.5"/>`);
      partes.push(`<text x="76" y="${y + 38}" font-family="${SANS}" font-size="${MIN_FUENTE}" letter-spacing="3" fill="${acento}">LA IDEA CENTRAL</text>`);
      lc.forEach((l, i) => partes.push(`<text x="76" y="${y + 78 + i * 36}" font-family="${SERIF}" font-size="28" font-style="italic" fill="#f1ede4">${esc(l)}</text>`));
      y += h + 30;
    } else y += 10;

    // Pie
    partes.push(`<text x="${W / 2}" y="${y + 14}" text-anchor="middle" font-family="${SANS}" font-size="${MIN_FUENTE}" letter-spacing="4" fill="#5d6877">MENTE FRÍA</text>`);
    const H = y + 50;

    const defs = `<defs><radialGradient id="g" cx="50%" cy="0%" r="80%"><stop offset="0" stop-color="${acento}" stop-opacity="0.16"/><stop offset="1" stop-color="${acento}" stop-opacity="0"/></radialGradient></defs>`;
    const tituloA11y = `Mapa visual de ${limpiar(e.titulo)}: ` + e.nodos.map((n, i) => `${i + 1}. ${limpiar(n.etiqueta)}`).join('; ');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tituloA11y)}">`
      + defs + `<rect width="${W}" height="${H}" fill="#0d1117"/><rect width="${W}" height="${H}" fill="url(#g)"/>`
      + partes.join('') + '</svg>';
  }

  /** URI lista para usar en <img src>. */
  function aDataUri(s) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); }

  return { W, MIN_FUENTE, ICONOS, ACENTOS, envolver, validar, svg, aDataUri };
});
