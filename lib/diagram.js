/**
 * Diagrama — motor de diagramas didácticos.
 *
 * Una lección guarda la *especificación* del diagrama (JSON en
 * `lecciones.imagenes_inline`) y esta librería la dibuja como SVG en línea:
 * misma tipografía y paleta que el resto de la página, legible en móvil,
 * adaptado al modo Kindle (variables CSS) y con texto alternativo.
 *
 * Spec:
 *   { tipo:'diagrama', plantilla:'pasos', titulo:'…', pie:'…', datos:{…} }
 *
 * Plantillas cualitativas: pasos · matriz · ciclo · comparar · espectro · piramide ·
 *                          mapa · curva · cifras · tiempo
 * Plantillas cuantitativas (matemática sencilla): grafica · barras · formula · tabla ·
 *                          arbol · venn · recta
 *
 * Tonos de color: a (dorado) · ok · mal · info · psi · mute
 *
 * UMD: window.Diagrama en el navegador, module.exports en tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Diagrama = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const W = 440;          // ancho del lienzo (unidades de usuario)
  const PAD = 18;
  const FT = 16;          // fuente de títulos
  const FD = 14.5;        // fuente de descripciones
  const CW_T = 0.585;     // ancho medio de carácter (em) — negrita
  const CW_D = 0.545;     // ancho medio de carácter (em) — normal
  const TONOS = ['a', 'ok', 'mal', 'info', 'psi', 'mute'];

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const tn = t => (TONOS.indexOf(t) >= 0 ? t : 'a');
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r1 = n => Math.round(n * 10) / 10;

  /* ── texto ── */
  function wrap(text, maxW, fs, cw) {
    const maxChars = Math.max(4, Math.floor(maxW / (fs * (cw || CW_D))));
    // Se parte solo por espacios normales: el espacio duro (U+00A0) mantiene unidos «72 %» o «A 2 · B 1».
    const words = String(text == null ? '' : text).replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '').split(/[ \t\r\n]+/).filter(Boolean);
    const lines = [];
    let cur = '';
    const push = w => {
      while (w.length > maxChars * 1.2) { lines.push(w.slice(0, maxChars - 1) + '-'); w = w.slice(maxChars - 1); }
      return w;
    };
    for (const w0 of words) {
      const w = push(w0);
      if (!cur) { cur = w; continue; }
      if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function txt(x, y, lines, cls, lh, anchor) {
    if (!lines.length) return '';
    const a = anchor ? ` text-anchor="${anchor}"` : '';
    return `<text class="${cls}" x="${r1(x)}" y="${r1(y)}"${a}>` +
      lines.map((l, i) => `<tspan x="${r1(x)}"${i ? ` dy="${lh}"` : ''}>${esc(l)}</tspan>`).join('') +
      '</text>';
  }

  /* bloque título+descripción → { svg, h } con la primera línea en y0+FT */
  function bloque(x, y0, w, t, d, anchor, tc) {
    const lt = wrap(t, w, FT, CW_T);
    const ld = d ? wrap(d, w, FD, CW_D) : [];
    let svg = txt(x, y0 + FT, lt, 'dg-t' + (tc ? ' ' + tc : ''), 20, anchor);
    let h = lt.length * 20;
    if (ld.length) {
      svg += txt(x, y0 + h + 3 + FD, ld, 'dg-d', 18, anchor);
      h += 3 + ld.length * 18;
    }
    return { svg, h };
  }

  function chevron(cx, y) {
    return `<path class="dg-arrow" d="M${r1(cx - 6)} ${r1(y - 3)} L${r1(cx)} ${r1(y + 3)} L${r1(cx + 6)} ${r1(y - 3)}"/>`;
  }
  function head(x, y, ang, s) {
    s = s || 7;
    const p = (a, d) => `${r1(x + Math.cos(a) * d)} ${r1(y + Math.sin(a) * d)}`;
    return `<path class="dg-arrow fill" d="M${p(ang, 0)} L${p(ang + 2.6, s)} L${p(ang - 2.6, s)} Z"/>`;
  }
  const box = (x, y, w, h, tono, r) =>
    `<rect class="dg-box tn-${tn(tono)}" x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${r || 10}"/>`;

  /* ═══════════════ PLANTILLAS ═══════════════
     Cada una devuelve { h, body, desc } con coordenadas locales. */

  function pasos(d) {
    const items = (d.pasos || []).slice(0, 8);
    if (!items.length) return null;
    const w = W - PAD * 2, tx = PAD + 56, tw = w - 56 - 14;
    let y = 8, body = '', desc = [];
    items.forEach((p, i) => {
      const b = bloque(tx, 0, tw, p.t, p.d);
      const h = Math.max(54, b.h + 28);
      const tono = p.tono || d.tono || 'a';
      body += box(PAD, y, w, h, tono);
      body += `<g class="tn-${tn(tono)}"><circle class="dg-num" cx="${PAD + 28}" cy="${r1(y + h / 2)}" r="15"/>` +
        `<text class="dg-numt" x="${PAD + 28}" y="${r1(y + h / 2 + 5.5)}" text-anchor="middle">${i + 1}</text></g>`;
      body += `<g transform="translate(0 ${r1(y + (h - b.h) / 2)})">${b.svg}</g>`;
      y += h;
      if (i < items.length - 1) { body += chevron(W / 2, y + 9); y += 20; }
      desc.push(`${i + 1}. ${p.t}${p.d ? ': ' + p.d : ''}`);
    });
    return { h: y + 8, body, desc: desc.join(' ') };
  }

  function matriz(d) {
    const c = (d.celdas || []).slice(0, 4);
    if (c.length < 4) return null;
    const ex = d.ejeX || {}, ey = d.ejeY || {};
    const left = PAD + 26, gap = 8;
    const cw = (W - PAD - left - gap) / 2, tw = cw - 24;
    const bl = c.map(x => bloque(0, 0, tw, x.t, x.d));
    // las dos etiquetas del eje Y (rotadas) deben caber sin tocarse
    const est = t => (t ? String(t).length * 13.5 * 0.6 : 0);
    const minFila = Math.max(70, (est(ey.arriba) + est(ey.abajo) + 30 - gap) / 2);
    const h1 = Math.max(minFila, bl[0].h + 26, bl[1].h + 26);
    const h2 = Math.max(minFila, bl[2].h + 26, bl[3].h + 26);
    // si el eje Y tiene etiquetas en sus extremos, su nombre va en horizontal encima de la matriz
    const nombreYArriba = !!ey.nombre && !!(ey.arriba || ey.abajo);
    const top = nombreYArriba ? 36 : 10;
    let body = nombreYArriba ? txt(left, 22, [ey.nombre], 'dg-ax b', 16, 'start') : '';
    [[0, 0, h1], [1, 0, h1], [0, 1, h2], [1, 1, h2]].forEach(([cx, cy, ch], i) => {
      const x = left + cx * (cw + gap), y = top + (cy ? h1 + gap : 0);
      body += box(x, y, cw, ch, c[i].tono || 'a');
      body += `<g transform="translate(${r1(x + 12)} ${r1(y + (ch - bl[i].h) / 2)})">${bl[i].svg}</g>`;
    });
    const bottom = top + h1 + gap + h2;
    const axY = bottom + 12;
    // eje X
    body += `<line class="dg-axis" x1="${left}" y1="${axY}" x2="${W - PAD}" y2="${axY}"/>` + head(W - PAD, axY, Math.PI, 7);
    if (ex.izq) body += txt(left, axY + 20, [ex.izq], 'dg-ax', 16, 'start');
    if (ex.der) body += txt(W - PAD, axY + 20, [ex.der], 'dg-ax', 16, 'end');
    // si las tres etiquetas del eje X no caben en una línea, el nombre baja a una segunda
    const wx = t => (t ? String(t).length * 16 * 0.56 : 0);
    const nombreAbajo = !!ex.nombre && wx(ex.izq) + wx(ex.der) + wx(ex.nombre) + 48 > W - PAD - left;
    if (ex.nombre) body += txt(left + (W - PAD - left) / 2, axY + (nombreAbajo ? 42 : 20), [ex.nombre], 'dg-ax b', 16, 'middle');
    // eje Y
    const ax = PAD + 8;
    body += `<line class="dg-axis" x1="${ax}" y1="${axY}" x2="${ax}" y2="${top}"/>` + head(ax, top, Math.PI / 2 * 3, 7);
    const rot = (x, y, s, a) => `<text class="dg-ax${a === 'middle' ? ' b' : ''}" transform="translate(${x} ${r1(y)}) rotate(-90)" text-anchor="${a}">${esc(s)}</text>`;
    if (ey.arriba) body += rot(ax - 6, top + 4, ey.arriba, 'end');
    if (ey.abajo) body += rot(ax - 6, axY - 4, ey.abajo, 'start');
    if (ey.nombre && !ey.arriba && !ey.abajo) body += rot(ax - 6, top + (axY - top) / 2, ey.nombre, 'middle');
    return { h: axY + (nombreAbajo ? 52 : 30), body, desc: c.map(x => x.t + (x.d ? ': ' + x.d : '')).join('. ') };
  }

  function ciclo(d) {
    const n = (d.nodos || []).slice(0, 6);
    if (n.length < 3) return null;
    const bw = 128, cx = W / 2, rx = (W - PAD * 2 - bw) / 2;
    let ry = n.length > 4 ? 140 : 118;
    const boxes = n.map(x => bloque(0, 0, bw - 16, x.t, x.d, 'middle'));
    const maxH = Math.max(...boxes.map(b => b.h)) + 20;
    // el texto central no debe rozar los nodos de arriba y de abajo
    const lcn = d.centro ? wrap(d.centro, 120, FT, CW_T).length : 0;
    const lsn = d.centroSub ? wrap(d.centroSub, 130, FD).length : 0;
    const extArriba = Math.max(0, lcn - 1) * 10 + 12;
    const extAbajo = lsn ? Math.max(0, lcn - 1) * 10 + 26 + (lsn - 1) * 18 + 6 : Math.max(0, lcn - 1) * 10 + 11;
    ry = Math.max(ry, maxH / 2 + Math.max(extArriba, extAbajo) + 12);
    const cy = ry + maxH / 2 + 10;
    const pos = n.map((_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n.length;
      return { a, x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
    });
    const inside = (px, py, p, bh) => Math.abs(px - p.x) < bw / 2 + 7 && Math.abs(py - p.y) < bh / 2 + 7;
    let body = '';
    n.forEach((_, i) => {
      const A = pos[i], B = pos[(i + 1) % n.length];
      const a0 = A.a, a1 = i === n.length - 1 ? -Math.PI / 2 + 2 * Math.PI : B.a;
      const pts = [];
      for (let k = 0; k <= 40; k++) {
        const a = a0 + ((a1 - a0) * k) / 40;
        const px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry;
        if (!inside(px, py, A, maxH) && !inside(px, py, B, maxH)) pts.push([px, py, a]);
      }
      if (pts.length > 1) {
        body += `<path class="dg-line" d="M${pts.map(p => r1(p[0]) + ' ' + r1(p[1])).join(' L')}"/>`;
        const e = pts[pts.length - 1], q = pts[pts.length - 2];
        body += head(e[0], e[1], Math.atan2(e[1] - q[1], e[0] - q[0]) + Math.PI, 8);
      }
    });
    n.forEach((x, i) => {
      const p = pos[i], b = boxes[i];
      body += box(p.x - bw / 2, p.y - maxH / 2, bw, maxH, x.tono || d.tono || 'a');
      body += `<g transform="translate(${r1(p.x)} ${r1(p.y - b.h / 2)})">${b.svg}</g>`;
    });
    if (d.centro) {
      const lc = wrap(d.centro, 120, FT, CW_T);
      body += txt(cx, cy - ((lc.length - 1) * 20) / 2 + 5, lc, 'dg-c', 20, 'middle');
      if (d.centroSub) body += txt(cx, cy + ((lc.length - 1) * 20) / 2 + 26, wrap(d.centroSub, 130, FD), 'dg-d', 18, 'middle');
    }
    return { h: cy + ry + maxH / 2 + 12, body, desc: n.map(x => x.t).join(' → ') + ' → (vuelve al inicio)' };
  }

  function comparar(d) {
    const A = d.izq || {}, B = d.der || {};
    if (!(A.items || []).length && !(B.items || []).length) return null;
    const gap = 12, cw = (W - PAD * 2 - gap) / 2, tw = cw - 32;
    const col = (C, x, tono) => {
      const head = wrap(C.t, cw - 24, FT, CW_T);
      let y = 14 + head.length * 20 + 12, s = txt(x + cw / 2, 14 + FT, head, 'dg-t tn-' + tn(tono), 20, 'middle');
      s += `<line class="dg-rule tn-${tn(tono)}" x1="${x + 14}" y1="${y - 4}" x2="${x + cw - 14}" y2="${y - 4}"/>`;
      (C.items || []).slice(0, 7).forEach(it => {
        const l = wrap(it, tw, FD);
        s += `<circle class="dg-dot tn-${tn(tono)}" cx="${x + 18}" cy="${y + 9}" r="2.6"/>`;
        s += txt(x + 28, y + FD, l, 'dg-d', 18);
        y += l.length * 18 + 8;
      });
      return { s, h: y + 8 };
    };
    const ta = A.tono || 'ok', tb = B.tono || 'mal';
    const a = col(A, PAD, ta), b = col(B, PAD + cw + gap, tb);
    const h = Math.max(a.h, b.h, 80);
    let body = box(PAD, 8, cw, h, ta) + box(PAD + cw + gap, 8, cw, h, tb);
    body += `<g transform="translate(0 8)">${a.s}${b.s}</g>`;
    return { h: h + 16, body, desc: `${A.t}: ${(A.items || []).join('; ')}. ${B.t}: ${(B.items || []).join('; ')}.` };
  }

  function espectro(d) {
    const polos = d.polos || [];
    if (polos.length < 2) return null;
    const x0 = PAD + 8, x1 = W - PAD - 8, bw = x1 - x0, lw = 120;
    const pa = wrap(polos[0], 160, FT, CW_T), pb = wrap(polos[1], 160, FT, CW_T);
    const top = 8 + Math.max(pa.length, pb.length) * 20 + 14;
    const ta = d.tonoA || 'ok', tb = d.tonoB || 'mal';
    const uid = 'sp' + Math.abs(hash(JSON.stringify(d)));
    let body = `<defs><linearGradient id="${uid}" x1="0" x2="1">` +
      `<stop offset="0" class="stop tn-${tn(ta)}"/><stop offset="1" class="stop tn-${tn(tb)}"/></linearGradient></defs>`;
    body += txt(x0, 8 + FT, pa, 'dg-t tn-' + tn(ta), 20, 'start') + txt(x1, 8 + FT, pb, 'dg-t tn-' + tn(tb), 20, 'end');
    body += `<rect class="dg-spec" x="${x0}" y="${top}" width="${bw}" height="12" rx="6" fill="url(#${uid})"/>`;
    const ms = (d.marcas || []).slice(0, 6)
      .map(m => ({ ...m, pos: clamp(num(m.pos, 0.5), 0, 1) }))
      .sort((p, q) => p.pos - q.pos);
    const placed = [];
    ms.forEach(m => {
      m.mx = x0 + m.pos * bw;
      m.lx = clamp(m.mx, PAD + lw / 2, W - PAD - lw / 2);
      m.bl = bloque(0, 0, lw - 8, m.t, m.d, 'middle');
      m.y = top + 34;
      placed.forEach(p => {
        if (Math.abs(p.lx - m.lx) < lw && m.y < p.y + p.bl.h + 10) m.y = p.y + p.bl.h + 16;
      });
      placed.push(m);
    });
    let maxY = top + 12;
    ms.forEach(m => {   // guías primero: las placas de las etiquetas las tapan si se cruzan
      body += `<line class="dg-line" x1="${r1(m.mx)}" y1="${top + 12}" x2="${r1(m.mx)}" y2="${r1(m.y - 6)}"/>`;
    });
    ms.forEach(m => {
      body += `<circle class="dg-pin tn-${tn(m.tono)}" cx="${r1(m.mx)}" cy="${top + 6}" r="8"/>`;
      body += `<rect class="dg-plate" x="${r1(m.lx - lw / 2)}" y="${r1(m.y - 4)}" width="${lw}" height="${r1(m.bl.h + 10)}" rx="6"/>`;
      body += `<g transform="translate(${r1(m.lx)} ${r1(m.y)})">${m.bl.svg}</g>`;
      maxY = Math.max(maxY, m.y + m.bl.h + 6);
    });
    return { h: maxY + 12, body, desc: `${polos[0]} ↔ ${polos[1]}. ` + ms.map(m => m.t).join(', ') };
  }

  function piramide(d) {
    const n = (d.niveles || []).slice(0, 6);
    if (n.length < 2) return null;
    let y = 8, body = '', desc = [];
    n.forEach((l, i) => {
      const f = n.length === 1 ? 1 : 0.46 + (0.54 * i) / (n.length - 1);
      const w = (W - PAD * 2) * f, x = (W - w) / 2;
      const b = bloque(W / 2, 0, w - 24, l.t, l.d, 'middle');
      const h = Math.max(48, b.h + 24);
      body += box(x, y, w, h, l.tono || d.tono || 'a', 8);
      body += `<g transform="translate(0 ${r1(y + (h - b.h) / 2)})">${b.svg}</g>`;
      y += h + 6; desc.push(l.t);
    });
    return { h: y + 4, body, desc: 'De arriba abajo: ' + desc.join(' › ') };
  }

  function mapa(d) {
    const n = (d.nodos || []).slice(0, 6);
    if (n.length < 2) return null;
    const sw = 134, r = 52, cx = W / 2;
    const L = [], R = [];
    n.forEach((x, i) => (i % 2 === 0 ? L : R).push(x));
    const meas = x => bloque(0, 0, sw - 20, x.t, x.d, 'start');
    const lay = arr => {
      const items = arr.map(x => ({ x, b: meas(x) }));
      items.forEach(i => { i.h = Math.max(54, i.b.h + 22); });
      return items;
    };
    const l = lay(L), rr = lay(R);
    const colH = a => a.reduce((s, i) => s + i.h, 0) + (a.length - 1) * 12;
    const H = Math.max(colH(l), colH(rr), r * 2 + 20) + 16;
    const cy = H / 2;
    let body = '';
    const place = (arr, x, side) => {
      let y = (H - colH(arr)) / 2;
      arr.forEach(i => {
        const my = y + i.h / 2;
        const ex = side < 0 ? cx - r : cx + r;
        const sx = side < 0 ? x + sw : x;
        body += `<path class="dg-line" d="M${r1(ex)} ${r1(cy)} C${r1((ex + sx) / 2)} ${r1(cy)} ${r1((ex + sx) / 2)} ${r1(my)} ${r1(sx)} ${r1(my)}"/>`;
        body += box(x, y, sw, i.h, i.x.tono || d.tono || 'a');
        body += `<g transform="translate(${r1(x + 10)} ${r1(y + (i.h - i.b.h) / 2)})">${i.b.svg}</g>`;
        y += i.h + 12;
      });
    };
    place(l, PAD, -1); place(rr, W - PAD - sw, 1);
    body += `<circle class="dg-hub" cx="${cx}" cy="${cy}" r="${r}"/>`;
    const lc = wrap(d.centro || '', r * 1.85, FT - 1, 0.5);
    body += txt(cx, cy - ((lc.length - 1) * 19) / 2 + 5, lc, 'dg-c', 19, 'middle');
    return { h: H, body, desc: `${d.centro}: ` + n.map(x => x.t).join(', ') };
  }

  function curva(d) {
    const P = (d.puntos || []).filter(p => Array.isArray(p) && p.length === 2);
    if (P.length < 2) return null;
    const left = PAD + 24, right = W - PAD - 4, top = 16, H = d.alto || 250, bot = top + H;
    const X = x => left + clamp(x, 0, 1) * (right - left - 6);
    const Y = y => bot - clamp(y, 0, 1) * (H - 12);
    let body = '';
    (d.zonas || []).forEach(z => {
      const zx0 = X(num(z.x0, 0)), zx1 = X(num(z.x1, 1));
      body += `<rect class="dg-zone tn-${tn(z.tono)}" x="${r1(zx0)}" y="${top}" width="${r1(zx1 - zx0)}" height="${H}"/>`;
      if (z.t) body += txt((zx0 + zx1) / 2, top + 18, wrap(z.t, zx1 - zx0 - 8, 13.5, CW_D), 'dg-d b tn-' + tn(z.tono), 16, 'middle');
    });
    body += `<line class="dg-axis" x1="${left}" y1="${bot}" x2="${right}" y2="${bot}"/>` + head(right, bot, Math.PI, 7);
    body += `<line class="dg-axis" x1="${left}" y1="${bot}" x2="${left}" y2="${top - 4}"/>` + head(left, top - 4, Math.PI * 1.5, 7);
    const pts = P.map(p => [X(p[0]), Y(p[1])]);
    let path = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      path += ` C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`;
    }
    body += `<path class="dg-curve tn-${tn(d.tono)}" d="${path}"/>`;
    // muestras de la curva para colocar las etiquetas donde no la pisen
    const muestras = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      for (let k = 0; k <= 16; k++) {
        const t = k / 16, u = 1 - t;
        muestras.push([
          u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0],
          u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1]
        ]);
      }
    }
    const ocupadas = [];
    const colocar = (lado, ex, ey, l, w) => {
      const n = l.length, alto = n * 16;
      let tx = ex, ty, an = 'middle';
      if (lado === 'arriba') ty = ey - 12 - (n - 1) * 16;
      else if (lado === 'abajo') ty = ey + 24;
      else if (lado === 'der') { tx = ex + 12; ty = ey + 5 - ((n - 1) * 16) / 2; an = 'start'; }
      else if (lado === 'izq') { tx = ex - 12; ty = ey + 5 - ((n - 1) * 16) / 2; an = 'end'; }
      else if (lado === 'arriba-der') { tx = ex + 8; ty = ey - 14 - (n - 1) * 16; an = 'start'; }
      else if (lado === 'abajo-der') { tx = ex + 8; ty = ey + 22; an = 'start'; }
      else if (lado === 'arriba-izq') { tx = ex - 8; ty = ey - 14 - (n - 1) * 16; an = 'end'; }
      else { tx = ex - 8; ty = ey + 22; an = 'end'; }
      if (an === 'middle') tx = clamp(tx, left + 56, right - 56);
      const x0 = an === 'middle' ? tx - w / 2 : an === 'start' ? tx : tx - w;
      return { tx, ty, an, caja: [x0, ty - 13, x0 + w, ty - 13 + alto + 2] };
    };
    const coste = c => {
      const [x0, y0, x1, y1] = c.caja;
      let k = 0;
      muestras.forEach(([mx, my]) => { if (mx > x0 - 3 && mx < x1 + 3 && my > y0 - 3 && my < y1 + 3) k++; });
      if (x0 < left + 2 || x1 > right + 4 || y0 < top - 14 || y1 > bot - 2) k += 40;
      ocupadas.forEach(([a0, b0, a1, b1]) => { if (x0 < a1 && x1 > a0 && y0 < b1 && y1 > b0) k += 60; });
      return k;
    };
    let minLy = top;
    (d.etiquetas || []).slice(0, 6).forEach(e => {
      const ex = X(num(e.x, 0)), ey = Y(num(e.y, 0));
      body += `<circle class="dg-pin tn-${tn(e.tono)}" cx="${r1(ex)}" cy="${r1(ey)}" r="5"/>`;
      const l = wrap(e.t, 112, 13.5, CW_D);
      const w = Math.max(...l.map(s => s.length)) * 13.5 * CW_D * 1.1 + 4;
      const pedido = e.lado || 'arriba';
      const lados = [pedido].concat(['arriba', 'abajo', 'der', 'izq', 'arriba-der', 'abajo-der', 'arriba-izq', 'abajo-izq'].filter(x => x !== pedido));
      let mejor = null, mejorCoste = Infinity;
      lados.forEach(ld => { const c = colocar(ld, ex, ey, l, w), k = coste(c); if (k < mejorCoste) { mejor = c; mejorCoste = k; } });
      ocupadas.push(mejor.caja);
      body += txt(mejor.tx, mejor.ty, l, 'dg-d b tn-' + tn(e.tono), 16, mejor.an);
      minLy = Math.min(minLy, mejor.ty - 14);
    });
    const ex = d.ejeX, ey = d.ejeY;
    if (ex) body += txt((left + right) / 2, bot + 22, [ex], 'dg-ax b', 16, 'middle');
    if (ey) body += `<text class="dg-ax b" transform="translate(${left - 8} ${r1(top + H / 2)}) rotate(-90)" text-anchor="middle">${esc(ey)}</text>`;
    return { h: bot + (ex ? 32 : 14), body, desc: (d.etiquetas || []).map(e => e.t).join('; ') };
  }

  function cifras(d) {
    const it = (d.items || []).slice(0, 6);
    if (!it.length) return null;
    const gap = 10, cols = it.length === 1 ? 1 : 2, cw = (W - PAD * 2 - gap * (cols - 1)) / cols;
    let body = '', y = 8, desc = [];
    for (let i = 0; i < it.length; i += cols) {
      const row = it.slice(i, i + cols).map(x => ({ x, l: wrap(x.t, cw - 28, FD) }));
      const h = Math.max(...row.map(r => 52 + r.l.length * 18)) + 10;
      row.forEach((r, k) => {
        const x = PAD + k * (cw + gap);
        body += box(x, y, cw, h, r.x.tono || d.tono || 'a');
        body += `<text class="dg-big tn-${tn(r.x.tono || d.tono)}" x="${r1(x + 14)}" y="${r1(y + 40)}">${esc(r.x.n)}</text>`;
        body += txt(x + 14, y + 40 + 8 + FD, r.l, 'dg-d', 18);
        desc.push(`${r.x.n}: ${r.x.t}`);
      });
      y += h + gap;
    }
    return { h: y - gap + 8, body, desc: desc.join('. ') };
  }

  function tiempo(d) {
    const ev = (d.eventos || []).slice(0, 8);
    if (!ev.length) return null;
    const fecha = e => String(e.f == null ? '' : e.f);
    // si alguna fecha no cabe en la columna izquierda, las fechas van encima de cada evento
    const apilar = Math.max(...ev.map(e => fecha(e).length)) * FT * 0.4 > 72;   // ~6,4 u. por carácter medido
    const lx = apilar ? PAD + 10 : PAD + 74, tw = W - PAD - lx - 18;
    const dy = apilar ? 22 : 0;
    let y = 10, body = '', desc = [];
    const bs = ev.map(e => bloque(lx + 18, 0, tw, e.t, e.d));
    const total = bs.reduce((s, b) => s + Math.max(b.h, 22) + dy + 20, 0);
    body += `<line class="dg-axis" x1="${lx}" y1="6" x2="${lx}" y2="${total}"/>`;
    ev.forEach((e, i) => {
      const b = bs[i], h = Math.max(b.h, 22) + dy;
      body += `<circle class="dg-pin tn-${tn(e.tono)}" cx="${lx}" cy="${y + 11}" r="6"/>`;
      if (apilar) body += txt(lx + 18, y + 16, [fecha(e)], 'dg-t tn-' + tn(e.tono), 18, 'start');
      else body += txt(lx - 14, y + 5 + 11, [fecha(e)], 'dg-t tn-' + tn(e.tono), 18, 'end');
      body += `<g transform="translate(0 ${y + dy})">${b.svg}</g>`;
      y += h + 20; desc.push(`${e.f}: ${e.t}`);
    });
    return { h: y, body, desc: desc.join('. ') };
  }

  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h;
  }


  /* ═══════════════ MATEMÁTICA SENCILLA ═══════════════
     Números con coma decimal, escalas «bonitas» y un evaluador de expresiones sin eval
     (para dibujar funciones como x^2 o 1-exp(-x) a partir de su fórmula). */

  /** 0.30000000000000004 → «0,3»; 1200 → «1200». */
  const fnum = n => (typeof n === 'number' && isFinite(n)) ? String(Math.round(n * 1e6) / 1e6).replace('.', ',') : '';

  /** Marcas de escala redondas entre min y max (≈ n marcas). */
  function marcas(min, max, n) {
    const span = max - min;
    if (!(span > 0)) return [min];
    const raw = span / (n || 5), mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    const paso = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
    const out = [];
    for (let k = Math.ceil(min / paso - 1e-9); k * paso <= max + paso * 1e-9; k++) {
      const v = parseFloat((k * paso).toPrecision(12));
      out.push(v === 0 ? 0 : v);   // sin -0 ni 0,6000000000000001
    }
    return out;
  }

  // Sin prototipo: «constructor», «toString»… no deben contar como funciones ni constantes permitidas.
  const FUNC = Object.assign(Object.create(null), {
    sqrt: Math.sqrt, exp: Math.exp, ln: Math.log, log: Math.log, log10: Math.log10, log2: Math.log2,
    abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan, min: Math.min, max: Math.max
  });
  const CONST = Object.assign(Object.create(null), { pi: Math.PI, e: Math.E });

  /** Compila «0.5*x^2 - 3*x» a una función de x. null si no es una expresión permitida. */
  function compilar(expr) {
    const src = String(expr == null ? '' : expr).trim();
    if (!src || src.length > 120) return null;
    const re = /\s*(?:(\d+\.?\d*|\.\d+)|([a-z][a-z0-9]*)|(\*\*|[-+*\/^(),]))/gy;
    const tok = [];
    let m, fin = 0;
    while (fin < src.length) {
      re.lastIndex = fin;
      m = re.exec(src);
      if (!m) return null;
      tok.push(m[1] !== undefined ? { n: parseFloat(m[1]) } : m[2] !== undefined ? { id: m[2].toLowerCase() } : { op: m[3] === '**' ? '^' : m[3] });
      fin = re.lastIndex;
      while (fin < src.length && /\s/.test(src[fin])) fin++;
    }
    let i = 0;
    const ok = op => tok[i] && tok[i].op === op;
    function expr_() {
      let a = term();
      while (ok('+') || ok('-')) { const op = tok[i++].op, b = term(), l = a; a = op === '+' ? x => l(x) + b(x) : x => l(x) - b(x); }
      return a;
    }
    function term() {
      let a = unary();
      while (ok('*') || ok('/')) { const op = tok[i++].op, b = unary(), l = a; a = op === '*' ? x => l(x) * b(x) : x => l(x) / b(x); }
      return a;
    }
    function unary() {
      if (ok('-')) { i++; const a = unary(); return x => -a(x); }
      if (ok('+')) { i++; return unary(); }
      return pot();
    }
    function pot() {
      const a = atomo();
      if (ok('^')) { i++; const b = unary(); return x => Math.pow(a(x), b(x)); }
      return a;
    }
    function atomo() {
      const t = tok[i++];
      if (!t) throw new Error('fin inesperado');
      if (t.n !== undefined) return () => t.n;
      if (t.op === '(') { const a = expr_(); if (!ok(')')) throw new Error('falta )'); i++; return a; }
      if (t.id !== undefined) {
        if (ok('(')) {
          if (!FUNC[t.id]) throw new Error('función no permitida');
          i++;
          const args = [expr_()];
          while (ok(',')) { i++; args.push(expr_()); }
          if (!ok(')')) throw new Error('falta )');
          i++;
          const f = FUNC[t.id];
          return x => f.apply(null, args.map(a => a(x)));
        }
        if (t.id === 'x') return x => x;
        if (t.id in CONST) { const c = CONST[t.id]; return () => c; }
        throw new Error('símbolo desconocido');
      }
      throw new Error('símbolo inesperado');
    }
    try {
      const f = expr_();
      if (i !== tok.length) return null;
      return f;
    } catch (e) { return null; }
  }

  /** Rejilla + ejes + marcas numéricas de un plano. Devuelve funciones de escala y el SVG de fondo. */
  function plano(d, geo) {
    const { left, right, top, bot } = geo;
    const xmin = num(d.xmin, 0), xmax = num(d.xmax, 1), ymin = num(d.ymin, 0), ymax = num(d.ymax, 1);
    if (!(xmax > xmin) || !(ymax > ymin)) return null;
    const X = v => left + (v - xmin) / (xmax - xmin) * (right - left);
    const Y = v => bot - (v - ymin) / (ymax - ymin) * (bot - top);
    const escala = d.sinEscala !== true;
    let body = '';
    const tx = marcas(xmin, xmax, 6), ty = marcas(ymin, ymax, 5);
    if (escala) {
      ty.forEach(v => { body += `<line class="dg-grid" x1="${r1(left)}" y1="${r1(Y(v))}" x2="${r1(right)}" y2="${r1(Y(v))}"/>`; });
      tx.forEach(v => { body += `<line class="dg-grid" x1="${r1(X(v))}" y1="${r1(top)}" x2="${r1(X(v))}" y2="${r1(bot)}"/>`; });
    }
    const ax = (xmin < 0 && xmax > 0) ? X(0) : left, ay = (ymin < 0 && ymax > 0) ? Y(0) : bot;
    body += `<line class="dg-axis" x1="${r1(left)}" y1="${r1(ay)}" x2="${r1(right)}" y2="${r1(ay)}"/>` + head(right + 2, ay, Math.PI, 7);
    body += `<line class="dg-axis" x1="${r1(ax)}" y1="${r1(bot)}" x2="${r1(ax)}" y2="${r1(top - 2)}"/>` + head(ax, top - 4, Math.PI * 1.5, 7);
    if (escala) {
      ty.forEach(v => { if (Math.abs(Y(v) - ay) > 9 || true) body += `<text class="dg-tick" x="${r1(left - 6)}" y="${r1(Y(v) + 4.5)}" text-anchor="end">${esc(fnum(v))}</text>`; });
      tx.forEach(v => { body += `<text class="dg-tick" x="${r1(X(v))}" y="${r1(bot + 17)}" text-anchor="middle">${esc(fnum(v))}</text>`; });
    }
    return { X, Y, body, xmin, xmax, ymin, ymax, ax, ay, escala };
  }

  /** Coloca etiquetas de forma que no pisen la curva ni otras etiquetas (la misma idea que `curva`). */
  function ubicarEtiquetas(items, muestras, lim, fijas) {
    const ocupadas = (fijas || []).slice(), out = [];
    const colocar = (lado, ex, ey, l, w) => {
      const n = l.length;
      let tx = ex, ty, an = 'middle';
      if (lado === 'arriba') ty = ey - 12 - (n - 1) * 16;
      else if (lado === 'abajo') ty = ey + 24;
      else if (lado === 'der') { tx = ex + 12; ty = ey + 5 - ((n - 1) * 16) / 2; an = 'start'; }
      else if (lado === 'izq') { tx = ex - 12; ty = ey + 5 - ((n - 1) * 16) / 2; an = 'end'; }
      else if (lado === 'arriba-der') { tx = ex + 8; ty = ey - 14 - (n - 1) * 16; an = 'start'; }
      else if (lado === 'abajo-der') { tx = ex + 8; ty = ey + 22; an = 'start'; }
      else if (lado === 'arriba-izq') { tx = ex - 8; ty = ey - 14 - (n - 1) * 16; an = 'end'; }
      else { tx = ex - 8; ty = ey + 22; an = 'end'; }
      if (an === 'middle') tx = clamp(tx, lim.l + w / 2, lim.r - w / 2);
      const x0 = an === 'middle' ? tx - w / 2 : an === 'start' ? tx : tx - w;
      return { tx, ty, an, caja: [x0, ty - 13, x0 + w, ty - 13 + n * 16 + 2] };
    };
    const coste = c => {
      const [x0, y0, x1, y1] = c.caja;
      let k = 0;
      muestras.forEach(([mx, my]) => { if (mx > x0 - 3 && mx < x1 + 3 && my > y0 - 3 && my < y1 + 3) k++; });
      if (x0 < lim.l - 2 || x1 > lim.r + 4 || y0 < lim.t - 14 || y1 > lim.b + 6) k += 40;
      ocupadas.forEach(([a0, b0, a1, b1]) => { if (x0 < a1 && x1 > a0 && y0 < b1 && y1 > b0) k += 60; });
      return k;
    };
    items.forEach(it => {
      const l = wrap(it.t, it.ancho || 112, 13.5, CW_D);
      const w = Math.max(...l.map(s => s.length)) * 13.5 * CW_D * 1.1 + 4;
      const pedido = it.lado || 'arriba';
      const lados = [pedido].concat(['arriba', 'abajo', 'der', 'izq', 'arriba-der', 'abajo-der', 'arriba-izq', 'abajo-izq'].filter(x => x !== pedido));
      let mejor = null, mc = Infinity;
      lados.forEach(ld => { const c = colocar(ld, it.x, it.y, l, w), k = coste(c); if (k < mc) { mejor = c; mc = k; } });
      ocupadas.push(mejor.caja);
      out.push({ ...mejor, l, tono: it.tono });
    });
    return out;
  }

  function grafica(d) {
    const left = PAD + 34, right = W - PAD - 8, top = 16, H = clamp(num(d.alto, 250), 150, 340), bot = top + H;
    const pl = plano(d, { left, right, top, bot });
    if (!pl) return null;
    const { X, Y, xmin, xmax, ymin, ymax } = pl;
    let body = pl.body;
    const fijas = [];   // cajas de texto ya ocupadas por zonas y líneas: las etiquetas de curvas y puntos las evitan
    const ancho = (l, fs) => Math.max(...l.map(t => t.length)) * fs * CW_D * 1.1 + 4;
    (d.zonas || []).slice(0, 3).forEach(z => {
      const a = X(clamp(num(z.x0, xmin), xmin, xmax)), b = X(clamp(num(z.x1, xmax), xmin, xmax));
      body += `<rect class="dg-zone tn-${tn(z.tono)}" x="${r1(a)}" y="${top}" width="${r1(Math.max(0, b - a))}" height="${H}"/>`;
      if (z.t) {
        const l = wrap(z.t, Math.max(40, b - a - 6), 13, CW_D), w = ancho(l, 13);
        body += txt((a + b) / 2, top + 16, l, 'dg-d b tn-' + tn(z.tono), 15, 'middle');
        fijas.push([(a + b) / 2 - w / 2, top + 3, (a + b) / 2 + w / 2, top + 16 + (l.length - 1) * 15 + 5]);
      }
    });
    (d.lineas || []).slice(0, 3).forEach(L => {
      const tono = tn(L.tono);
      if (typeof L.y === 'number' && L.y >= ymin && L.y <= ymax) {
        body += `<line class="dg-ref tn-${tono}" x1="${left}" y1="${r1(Y(L.y))}" x2="${right}" y2="${r1(Y(L.y))}"/>`;
        if (L.t) {
          const w = ancho([L.t], 13.5), abajo = Y(L.y) - top < 30, ty = abajo ? Y(L.y) + 17 : Y(L.y) - 6;
          body += txt(right - 2, ty, [L.t], 'dg-d b tn-' + tono, 15, 'end');
          fijas.push([right - 2 - w, ty - 13, right - 2, ty + 4]);
        }
      } else if (typeof L.x === 'number' && L.x >= xmin && L.x <= xmax) {
        body += `<line class="dg-ref tn-${tono}" x1="${r1(X(L.x))}" y1="${top}" x2="${r1(X(L.x))}" y2="${bot}"/>`;
        if (L.t) {
          const w = ancho([L.t], 13.5), izq = X(L.x) + 5 + w > right;
          const tx = izq ? X(L.x) - 5 : X(L.x) + 5;
          body += txt(tx, bot - 8, [L.t], 'dg-d b tn-' + tono, 15, izq ? 'end' : 'start');
          fijas.push([izq ? tx - w : tx, bot - 21, izq ? tx : tx + w, bot - 4]);
        }
      }
    });
    const muestras = [], nombres = [];
    (d.series || []).slice(0, 3).forEach(S => {
      const f = S.f ? compilar(S.f) : null;
      let pts = [];
      if (f) {
        const N = 160;
        for (let k = 0; k <= N; k++) { const x = xmin + (xmax - xmin) * k / N; pts.push([x, f(x)]); }
      } else {
        pts = (S.puntos || []).filter(p => Array.isArray(p) && p.length === 2 && isFinite(p[0]) && isFinite(p[1]));
      }
      if (pts.length < 2) return;
      let path = '', abierto = false, prev = null;
      const aY = y => y < ymin ? ymin : y > ymax ? ymax : y;
      pts.forEach(([x, y]) => {
        const dentro = isFinite(y) && y >= ymin && y <= ymax;
        if (!isFinite(y)) { abierto = false; prev = null; return; }
        if (dentro) {
          if (!abierto) {
            if (prev && isFinite(prev[1]) && !(prev[1] >= ymin && prev[1] <= ymax)) {   // entra desde fuera: corta en el borde
              const yb = prev[1] < ymin ? ymin : ymax, t = (yb - prev[1]) / (y - prev[1]), xb = prev[0] + t * (x - prev[0]);
              path += `M${r1(X(xb))} ${r1(Y(yb))}L${r1(X(x))} ${r1(Y(y))}`;
            } else path += `M${r1(X(x))} ${r1(Y(y))}`;
            abierto = true;
          } else path += `L${r1(X(x))} ${r1(Y(y))}`;
          muestras.push([X(x), Y(y)]);
        } else if (abierto && prev) {                                                    // sale por arriba o por abajo
          const yb = y < ymin ? ymin : ymax, t = (yb - prev[1]) / (y - prev[1]), xb = prev[0] + t * (x - prev[0]);
          path += `L${r1(X(xb))} ${r1(Y(yb))}`;
          abierto = false;
        }
        prev = [x, y];
      });
      if (!path) return;
      body += `<path class="dg-curve tn-${tn(S.tono)}${S.discontinua ? ' dash' : ''}" d="${path}"/>`;
      if (S.t) {
        const fx = clamp(num(S.x, xmin + (xmax - xmin) * 0.88), xmin, xmax);
        let fy = f ? f(fx) : null;
        if (fy == null || !isFinite(fy)) { const c = pts.reduce((a, p) => Math.abs(p[0] - fx) < Math.abs(a[0] - fx) ? p : a, pts[0]); fy = c[1]; }
        nombres.push({ x: X(fx), y: Y(clamp(fy, ymin, ymax)), t: S.t, tono: S.tono, lado: S.lado || 'arriba' });
      }
    });
    const pines = (d.puntos || []).slice(0, 5).filter(p => typeof p.x === 'number' && typeof p.y === 'number')
      .map(p => ({ x: X(clamp(p.x, xmin, xmax)), y: Y(clamp(p.y, ymin, ymax)), t: p.t || '', tono: p.tono, lado: p.lado || 'arriba', pin: true }));
    pines.forEach(p => { body += `<circle class="dg-pin tn-${tn(p.tono)}" cx="${r1(p.x)}" cy="${r1(p.y)}" r="5"/>`; });
    const todos = nombres.concat(pines.filter(p => p.t));
    ubicarEtiquetas(todos, muestras, { l: left, r: right, t: top, b: bot }, fijas).forEach(e => {
      body += txt(e.tx, e.ty, e.l, 'dg-d b tn-' + tn(e.tono), 16, e.an);
    });
    let h = bot + (pl.escala ? 26 : 12);
    if (d.ejeX) { body += txt((left + right) / 2, h + 14, [d.ejeX], 'dg-ax b', 16, 'middle'); h += 22; }
    if (d.ejeY) body += `<text class="dg-ax b" transform="translate(${PAD - 2} ${r1(top + H / 2)}) rotate(-90)" text-anchor="middle">${esc(d.ejeY)}</text>`;
    return { h: h + 6, body, desc: (d.series || []).map(s => s.t || s.f).filter(Boolean).concat((d.puntos || []).map(p => p.t).filter(Boolean)).join('; ') };
  }

  function barras(d) {
    const it = (d.items || []).filter(x => x && typeof x.v === 'number' && isFinite(x.v)).slice(0, 8);
    if (!it.length) return null;
    const unidad = d.unidad ? String(d.unidad) : '';
    const min = Math.min(0, ...it.map(x => x.v)), max = Math.max(0, ...it.map(x => x.v), num(d.ref && d.ref.v, -Infinity));
    const tope = typeof d.max === 'number' && d.max > max ? d.max : max * 1.08 || 1;
    const lw = 128, left = PAD + lw + 8, right = W - PAD - 46;
    const X = v => left + (v - min) / (tope - min) * (right - left);
    let y = d.ref ? 22 : 6, body = '';
    const x0 = X(0);
    it.forEach(b => {
      const l = wrap(b.t, lw, FD, CW_D), h = Math.max(32, l.length * 17 + 8);
      body += txt(PAD + lw, y + h / 2 - ((l.length - 1) * 17) / 2 + 5, l, 'dg-d', 17, 'end');
      const xa = Math.min(x0, X(b.v)), wb = Math.max(2, Math.abs(X(b.v) - x0));
      body += `<rect class="dg-bar tn-${tn(b.tono || d.tono)}" x="${r1(xa)}" y="${r1(y + 5)}" width="${r1(wb)}" height="${r1(h - 10)}" rx="4"/>`;
      const vl = fnum(b.v) + (unidad ? (/^[%°]/.test(unidad) ? '' : ' ') + unidad : '');
      body += b.v >= 0 ? txt(X(b.v) + 6, y + h / 2 + 5, [vl], 'dg-d b', 16, 'start') : txt(x0 + 6, y + h / 2 + 5, [vl], 'dg-d b', 16, 'start');
      y += h;
    });
    body += `<line class="dg-axis" x1="${r1(x0)}" y1="2" x2="${r1(x0)}" y2="${r1(y)}"/>`;
    if (d.ref && typeof d.ref.v === 'number') {
      body += `<line class="dg-ref tn-${tn(d.ref.tono || 'mal')}" x1="${r1(X(d.ref.v))}" y1="${d.ref.t ? 18 : 2}" x2="${r1(X(d.ref.v))}" y2="${r1(y)}"/>`;
      if (d.ref.t) body += txt(X(d.ref.v), 12, [d.ref.t], 'dg-d b tn-' + tn(d.ref.tono || 'mal'), 15, 'middle');
    }
    return { h: y + 8, body, desc: it.map(b => `${b.t}: ${fnum(b.v)}${unidad ? ' ' + unidad : ''}`).join('; ') };
  }

  function formula(d) {
    const ls = (d.lineas || []).map(String).filter(Boolean).slice(0, 3);
    if (!ls.length) return null;
    const w = W - PAD * 2;
    let y = 8, body = '';
    const tono = tn(d.tono);
    const largo = l => l.replace(/\^(?:\{[^}]*\}|[A-Za-z\u0391-\u03c9\d.,+\u2212-]+)/g, 'x');   // un exponente ocupa poco: cuenta como un carácter
    const fs = clamp(Math.min(...ls.map(l => (w - 36) / Math.max(6, largo(l).length) / 0.56)), 17, 31);
    const hb = ls.length * (fs * 1.55) + 22;
    body += box(PAD, y, w, hb, tono, 12);
    /** «10^α» → 10 con α como superíndice (con desplazamientos en px: funciona igual en todos los navegadores). */
    const conExponentes = l => {
      const up = r1(fs * 0.38);
      let out = '', bajar = false, ult = 0, m;
      const re = /\^(?:\{([^}]*)\}|([A-Za-z\u0391-\u03c9\d.,+\u2212-]+))/g;
      while ((m = re.exec(l))) {
        const tx = l.slice(ult, m.index);
        if (tx || bajar) { out += `<tspan${bajar ? ` dy="${up}"` : ''}>${esc(tx)}</tspan>`; bajar = false; }
        out += `<tspan dy="${-up}" style="font-size:${r1(fs * 0.68)}px">${esc(m[1] !== undefined ? m[1] : m[2])}</tspan>`;
        bajar = true; ult = re.lastIndex;
      }
      const resto = l.slice(ult);
      if (resto || bajar) out += `<tspan${bajar ? ` dy="${up}"` : ''}>${esc(resto)}</tspan>`;
      return out || esc(l);
    };
    ls.forEach((l, i) => { body += `<text class="dg-formula tn-${tono}" x="${W / 2}" y="${r1(y + 18 + fs * 1.1 + i * fs * 1.55)}" text-anchor="middle" style="font-size:${r1(fs)}px">${conExponentes(l)}</text>`; });
    y += hb + 14;
    const T = (d.terminos || []).slice(0, 6);
    if (T.length) {
      body += txt(PAD + 2, y + 13, ['donde'], 'dg-ax b', 16);
      y += 24;
      T.forEach(t => {
        const l = wrap(t.t, w - 70, FD, CW_D), h = Math.max(30, l.length * 17 + 8);
        body += `<text class="dg-sym tn-${tn(t.tono || tono)}" x="${PAD + 24}" y="${r1(y + h / 2 + 7)}" text-anchor="middle">${esc(t.s)}</text>`;
        body += txt(PAD + 56, y + h / 2 - ((l.length - 1) * 17) / 2 + 5, l, 'dg-d', 17);
        y += h;
      });
    }
    if (d.nota) { const l = wrap(d.nota, w, FD, CW_D); body += txt(PAD + 2, y + 18, l, 'dg-d i', 17); y += l.length * 17 + 8; }
    const leer = l => l.replace(/\^\{([^}]*)\}|\^(\S+)/g, (_, a, b) => ' elevado a ' + (a !== undefined ? a : b));   // para el lector de pantalla
    return { h: y + 8, body, desc: ls.map(leer).join('; ') + (T.length ? '. ' + T.map(t => `${t.s}: ${t.t}`).join('; ') : '') };
  }

  function tabla(d) {
    const cols = (d.cols || []).map(String).slice(0, 4);
    const filas = (d.filas || []).filter(f => f && Array.isArray(f.c)).slice(0, 5);
    if (cols.length < 2 || filas.length < 1) return null;
    const w = W - PAD * 2, c0 = d.sinEtiquetas ? 0 : 112, cw = (w - c0) / cols.length;
    const res = new Set((d.resaltar || []).filter(p => Array.isArray(p)).map(p => p[0] + ',' + p[1]));
    let y = 6, body = '';
    const cab = cols.map(c => wrap(c, cw - 10, FD, CW_T));
    const hc = Math.max(...cab.map(l => l.length)) * 17 + 14;
    if (d.esquina && c0) body += txt(PAD + 8, y + hc / 2 + 5, wrap(d.esquina, c0 - 12, 13, CW_D), 'dg-ax', 16);
    cab.forEach((l, j) => { body += txt(PAD + c0 + cw * (j + 0.5), y + hc / 2 - ((l.length - 1) * 17) / 2 + 5, l, 'dg-t', 17, 'middle'); });
    y += hc;
    body += `<line class="dg-axis" x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}"/>`;
    filas.forEach((f, i) => {
      const cs = cols.map((_, j) => wrap(String(f.c[j] == null ? '' : f.c[j]), cw - 12, FD, CW_D));
      const lt = c0 ? wrap(f.t || '', c0 - 12, FD, CW_T) : [];
      const h = Math.max(40, Math.max(...cs.map(l => l.length), lt.length) * 17 + 16);
      cols.forEach((_, j) => {
        const x = PAD + c0 + cw * j;
        const dest = res.has(i + ',' + j);
        body += `<rect class="dg-celda${dest ? ' hi tn-' + tn(f.tono || d.tono) : ''}" x="${r1(x + 2)}" y="${r1(y + 2)}" width="${r1(cw - 4)}" height="${r1(h - 4)}" rx="7"/>`;
        body += txt(x + cw / 2, y + h / 2 - ((cs[j].length - 1) * 17) / 2 + 5, cs[j], 'dg-d' + (dest ? ' bb' : ''), 17, 'middle');
      });
      if (c0) body += txt(PAD + 8, y + h / 2 - ((lt.length - 1) * 17) / 2 + 5, lt, 'dg-t', 17);
      y += h;
    });
    return { h: y + 8, body, desc: filas.map(f => `${f.t || ''}: ${f.c.join(', ')}`).join('; ') };
  }

  function arbol(d) {
    const ramas = (d.ramas || []).slice(0, 4);
    if (!ramas.length || !d.raiz) return null;
    const dos = ramas.some(r => Array.isArray(r.ramas) && r.ramas.length);
    const hojas = ramas.reduce((n, r) => n + (dos ? Math.max(1, Math.min(3, (r.ramas || []).length)) : 1), 0);
    const rowH = 56, top = 10, H = Math.max(hojas * rowH, 96);
    const wr = 76, w1 = dos ? 108 : 150, w2 = 128;
    const gap = dos ? (W - PAD * 2 - wr - w1 - w2) / 2 : (W - PAD * 2 - wr - w1);
    const xr = PAD, x1 = xr + wr + gap, x2 = x1 + w1 + gap;
    const nodo = (x, cy, w, t, tono, fuerte) => {
      const l = wrap(t, w - 14, 13.5, fuerte ? CW_T : CW_D), h = Math.max(34, l.length * 16 + 12);
      return box(x, cy - h / 2, w, h, tono, 8) + txt(x + w / 2, cy - ((l.length - 1) * 16) / 2 + 5, l, 'dg-d' + (fuerte ? ' b' : ''), 16, 'middle');
    };
    const rama = (xa, ya, xb, yb, t, tono) => {
      const xm = (xa + xb) / 2;
      let s = `<path class="dg-line tn-${tn(tono)}" d="M${r1(xa)} ${r1(ya)} C${r1(xm)} ${r1(ya)} ${r1(xm)} ${r1(yb)} ${r1(xb)} ${r1(yb)}"/>`;
      if (t) {
        const l = String(t), wl = l.length * 13 * 0.56 + 8;
        s += `<rect class="dg-plate" x="${r1(xm - wl / 2)}" y="${r1((ya + yb) / 2 - 10)}" width="${r1(wl)}" height="20" rx="4"/>` +
          `<text class="dg-d b tn-${tn(tono)}" x="${r1(xm)}" y="${r1((ya + yb) / 2 + 4.5)}" text-anchor="middle" style="font-size:13px">${esc(l)}</text>`;
      }
      return s;
    };
    let body = '', fila = 0;
    const cyR = top + H / 2;
    const dibujadas = [];
    ramas.forEach(r => {
      const hs = dos ? (r.ramas || []).slice(0, 3) : [];
      const n = Math.max(1, hs.length), c1 = top + (fila + n / 2) * rowH;
      const hijos = hs.map((h, k) => ({ h, cy: top + (fila + k + 0.5) * rowH }));
      dibujadas.push({ r, c1, hijos });
      fila += n;
    });
    dibujadas.forEach(({ r, c1, hijos }) => {
      body += rama(xr + wr, cyR, x1, c1, r.t, r.tono);
      hijos.forEach(({ h, cy }) => { body += rama(x1 + w1, c1, x2, cy, h.t, h.tono || r.tono); });
    });
    body += nodo(xr, cyR, wr, d.raiz, d.tono || 'a', true);
    dibujadas.forEach(({ r, c1, hijos }) => {
      body += nodo(x1, c1, w1, r.n || '', r.tono, !!hijos.length);
      hijos.forEach(({ h, cy }) => { body += nodo(x2, cy, w2, h.n || '', h.tono || r.tono, false); });
    });
    return { h: top + H + 10, body, desc: `${d.raiz}: ` + ramas.map(r => `${r.t || ''} ${r.n || ''}`.trim()).join('; ') };
  }

  function venn(d) {
    const cj = (d.conjuntos || []).slice(0, 3);
    if (cj.length < 2) return null;
    const R = cj.length === 2 ? 82 : 70, cy0 = 12;
    let pos;
    if (cj.length === 2) pos = [[W / 2 - R * 0.62, cy0 + R + 20], [W / 2 + R * 0.62, cy0 + R + 20]];
    else pos = [[W / 2 - R * 0.78, cy0 + R + 14], [W / 2 + R * 0.78, cy0 + R + 14], [W / 2, cy0 + R + 14 + R * 1.3]];
    let body = '', desc = [];
    cj.forEach((c, i) => { body += `<circle class="dg-venn tn-${tn(c.tono || TONOS[i + 1])}" cx="${r1(pos[i][0])}" cy="${r1(pos[i][1])}" r="${R}"/>`; });
    cj.forEach((c, i) => {
      const tono = tn(c.tono || TONOS[i + 1]);
      const l = wrap(c.t, 84, 14, CW_T);
      let tx = pos[i][0], ty = pos[i][1];
      if (cj.length === 2) tx += (i ? 1 : -1) * R * 0.5;
      else { tx += (i === 2 ? 0 : (i ? 1 : -1) * R * 0.42); ty += (i === 2 ? R * 0.5 : -R * 0.32); }
      body += txt(tx, ty - ((l.length - 1) * 8) + 4, l, 'dg-d b tn-' + tono, 16, 'middle');
      desc.push(c.t);
    });
    let y = pos[cj.length - 1][1] + R + 16;
    if (d.centro) {
      const cx = W / 2, cyy = cj.length === 2 ? pos[0][1] : pos[0][1] + R * 0.5;
      body += txt(cx, cyy - ((wrap(d.centro, 70, 13, CW_D).length - 1) * 8) + 4, wrap(d.centro, 70, 13, CW_D), 'dg-d b', 15, 'middle');
    }
    cj.forEach((c, i) => {
      if (!c.d) return;
      const tono = tn(c.tono || TONOS[i + 1]), l = wrap(c.d, W - PAD * 2 - 24, FD, CW_D);
      body += `<circle class="dg-dot tn-${tono}" cx="${PAD + 7}" cy="${r1(y + 9)}" r="5"/>`;
      body += txt(PAD + 22, y + 14, l, 'dg-d', 17);
      y += l.length * 17 + 8;
    });
    return { h: y + 6, body, desc: desc.join(' y ') + (d.centro ? `; en común: ${d.centro}` : '') };
  }

  function recta(d) {
    const min = num(d.min, 0), max = num(d.max, 1);
    if (!(max > min)) return null;
    const left = PAD + 14, right = W - PAD - 14;
    const X = v => left + (clamp(v, min, max) - min) / (max - min) * (right - left);
    const ints = (d.intervalos || []).slice(0, 3), ms = (d.marcas || []).slice(0, 6);
    let y0 = ints.length ? 12 : 4, body = '';
    const ejeY = y0 + (ints.length ? 70 : 60);
    ints.forEach((iv, k) => {
      const a = X(num(iv.x0, min)), b = X(num(iv.x1, max)), y = y0 + k * 22;
      body += `<rect class="dg-bar tn-${tn(iv.tono)}" x="${r1(a)}" y="${y}" width="${r1(Math.max(3, b - a))}" height="12" rx="6"/>`;
      if (iv.t) body += txt(b + 8 > right - 60 ? a - 8 : b + 8, y + 11, [iv.t], 'dg-d b tn-' + tn(iv.tono), 15, b + 8 > right - 60 ? 'end' : 'start');
    });
    body += `<line class="dg-axis" x1="${left - 6}" y1="${ejeY}" x2="${right + 8}" y2="${ejeY}"/>` + head(right + 10, ejeY, Math.PI, 7);
    marcas(min, max, 6).forEach(v => { body += `<line class="dg-axis" x1="${r1(X(v))}" y1="${ejeY - 5}" x2="${r1(X(v))}" y2="${ejeY + 5}"/><text class="dg-tick" x="${r1(X(v))}" y="${ejeY + 22}" text-anchor="middle">${esc(fnum(v))}</text>`; });
    let sube = true, ultimo = -1e9, hMax = ejeY + 30;
    ms.slice().sort((a, b) => a.x - b.x).forEach(m => {
      const x = X(num(m.x, min)), l = wrap(m.t, 92, 13.5, CW_D), n = l.length;
      body += `<circle class="dg-pin tn-${tn(m.tono)}" cx="${r1(x)}" cy="${ejeY}" r="5.5"/>`;
      if (Math.abs(x - ultimo) < 70) sube = !sube; else sube = true;
      ultimo = x;
      const tx = clamp(x, left + 40, right - 40);
      if (sube) body += txt(tx, ejeY - 14 - (n - 1) * 16, l, 'dg-d b tn-' + tn(m.tono), 16, 'middle');
      else { body += txt(tx, ejeY + 44, l, 'dg-d b tn-' + tn(m.tono), 16, 'middle'); hMax = Math.max(hMax, ejeY + 44 + n * 16); }
    });
    return { h: hMax + 8, body, desc: ms.map(m => `${fnum(m.x)}: ${m.t}`).join('; ') };
  }

  const PLANTILLAS = { pasos, matriz, ciclo, comparar, espectro, piramide, mapa, curva, cifras, tiempo, grafica, barras, formula, tabla, arbol, venn, recta };

  /* ═══════════════ API ═══════════════ */

  function valido(spec) {
    return !!(spec && typeof spec === 'object' && spec.tipo === 'diagrama' &&
      PLANTILLAS[spec.plantilla] && spec.datos && typeof spec.datos === 'object');
  }

  function svg(spec) {
    if (!valido(spec)) return '';
    let r = null;
    try { r = PLANTILLAS[spec.plantilla](spec.datos); } catch (e) { return ''; }
    if (!r) return '';
    const label = [spec.titulo, r.desc].filter(Boolean).join('. ');
    return `<svg class="dg-svg" viewBox="0 0 ${W} ${Math.ceil(r.h)}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMin meet">` +
      `<title>${esc(spec.titulo || 'Diagrama')}</title>${r.body}</svg>`;
  }

  /** <figure> completa: título, SVG y pie. '' si la spec no es válida. */
  function render(spec) {
    const s = svg(spec);
    if (!s) return '';
    return `<figure class="dg" data-plantilla="${esc(spec.plantilla)}" onclick="abrirZoomDiagrama(this)" title="Ampliar">` +
      (spec.titulo ? `<figcaption class="dg-title">${esc(spec.titulo)}</figcaption>` : '') +
      s +
      (spec.pie ? `<div class="dg-pie">${esc(spec.pie)}</div>` : '') +
      `</figure>`;
  }

  /** Extrae las specs válidas de `imagenes_inline` (acepta objeto suelto o lista). */
  function deLeccion(lec) {
    let v = lec && lec.imagenes_inline;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
    if (v && !Array.isArray(v)) v = [v];
    return (v || []).filter(valido);
  }

  return { render, svg, valido, deLeccion, wrap, compilar, marcas, fnum, plantillas: Object.keys(PLANTILLAS) };
});
