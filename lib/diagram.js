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
 * Plantillas: pasos · matriz · ciclo · comparar · espectro · piramide ·
 *             mapa · curva · cifras · tiempo
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
    const words = String(text == null ? '' : text).trim().split(/\s+/).filter(Boolean);
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
    const lx = PAD + 74, tw = W - PAD - lx - 18;
    let y = 10, body = '', desc = [];
    const bs = ev.map(e => bloque(lx + 18, 0, tw, e.t, e.d));
    const total = bs.reduce((s, b) => s + Math.max(b.h, 22) + 20, 0);
    body += `<line class="dg-axis" x1="${lx}" y1="6" x2="${lx}" y2="${total}"/>`;
    ev.forEach((e, i) => {
      const b = bs[i], h = Math.max(b.h, 22);
      body += `<circle class="dg-pin tn-${tn(e.tono)}" cx="${lx}" cy="${y + 11}" r="6"/>`;
      body += txt(lx - 14, y + 5 + 11, [String(e.f == null ? '' : e.f)], 'dg-t tn-' + tn(e.tono), 18, 'end');
      body += `<g transform="translate(0 ${y})">${b.svg}</g>`;
      y += h + 20; desc.push(`${e.f}: ${e.t}`);
    });
    return { h: y, body, desc: desc.join('. ') };
  }

  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h;
  }

  const PLANTILLAS = { pasos, matriz, ciclo, comparar, espectro, piramide, mapa, curva, cifras, tiempo };

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

  return { render, svg, valido, deLeccion, wrap, plantillas: Object.keys(PLANTILLAS) };
});
