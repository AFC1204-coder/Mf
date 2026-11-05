/* ═══════════════════════════════════════════
   TARJETA DE IDEA — comparte una idea de una lección como imagen (1080×1350).
   Todo en el dispositivo: sin servidor, sin datos personales. El texto es el de la lección (nunca reescrito);
   la lógica pura y sus pruebas están en lib/tarjeta.js. Usa los globales de app.js (lecs, libros, Diagrama, urlCarta, toast).
   Opciones: tema oscuro/claro, «el matiz» (primeras frases de la autocorrección) y el esquema de la lección si lo tiene
   (con su pie, que declara lo ilustrativo o calculado).
═══════════════════════════════════════════ */
const TarjetaUI = (() => {
  const PAL = {
    oscuro: { bg1: '#0b0b0b', bg2: '#17130b', texto: '#ede8df', suave: '#a8a094', tenue: '#6b645a', acento: '#c9a84c', panel: '#111111', linea: 'rgba(201,168,76,.35)' },
    claro:  { bg1: '#f6f1e5', bg2: '#ece3cf', texto: '#1d1a14', suave: '#5d564a', tenue: '#8c8472', acento: '#8a6a1c', panel: '#fbf8f0', linea: 'rgba(138,106,28,.35)' },
  };
  const F_IDEA = '"Playfair Display", Georgia, serif';
  const F_TXT = '"Source Serif 4", Georgia, serif';
  const F_UI = 'Outfit, "Helvetica Neue", Arial, sans-serif';
  let est = { lecId: null, claro: false, extra: 'nada' }, pintando = 0, canvas = null, ultimo = null;

  async function cargarFuentes() {
    try {
      await Promise.all([
        document.fonts.load('italic 400 48px "Playfair Display"'), document.fonts.load('400 34px "Playfair Display"'),
        document.fonts.load('italic 400 30px "Source Serif 4"'), document.fonts.load('400 26px "Source Serif 4"'), document.fonts.load('500 24px Outfit'),
      ]);
    } catch (e) {}
  }

  /** Copia los estilos calculados al SVG (como imagen aislada no ve las hojas de estilo de la página). */
  function enlinea(svg) {
    const props = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'dominant-baseline'];
    [svg, ...svg.querySelectorAll('*')].forEach(el => {
      const cs = getComputedStyle(el);
      el.setAttribute('style', props.map(p => `${p}:${cs.getPropertyValue(p)}`).join(';') + ';font-family:Outfit,"Helvetica Neue",Arial,sans-serif');
    });
  }
  async function imagenEsquema(lec) {
    const specs = (typeof Diagrama !== 'undefined') ? Diagrama.deLeccion(lec) : [];
    if (!specs.length) return null;
    const spec = specs[0];
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0;width:440px;pointer-events:none';
    host.innerHTML = '<style>*{animation:none!important;transition:none!important}</style>' + Diagrama.render(spec);
    document.body.appendChild(host);
    try {
      const svg = host.querySelector('svg');
      if (!svg) return null;
      enlinea(svg);
      const vb = svg.viewBox && svg.viewBox.baseVal;
      const w = (vb && vb.width) || 440, h = (vb && vb.height) || 300;
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('width', w * 2); svg.setAttribute('height', h * 2);
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
      await img.decode();
      return { img, w, h, titulo: spec.titulo || '', pie: spec.pie || '' };
    } catch (e) { return null; }
    finally { host.remove(); }
  }

  const medirCon = (ctx, fam, estilo) => (t, fs) => { ctx.font = `${estilo} ${fs}px ${fam}`; return ctx.measureText(t).width; };

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  const espaciado = (ctx, px) => { try { ctx.letterSpacing = px + 'px'; } catch (e) {} };

  async function dibujar(cv, lec, libro, op) {
    const T = Tarjeta, c = PAL[op.claro ? 'claro' : 'oscuro'];
    await cargarFuentes();
    const esq = op.extra === 'esquema' ? await imagenEsquema(lec) : null;
    const conMatiz = op.extra === 'matiz';
    cv.width = T.W; cv.height = T.H;
    const ctx = cv.getContext('2d');
    const medIdea = (t, fs) => medirCon(ctx, F_IDEA, 'italic 400')(t, fs);
    const medMatiz = (t, fs) => medirCon(ctx, F_TXT, 'italic 400')(t, fs);
    const medir = (t, fs) => (fs === 30 ? medMatiz(t, fs) : medIdea(t, fs));
    const p = T.plan(lec, { matiz: conMatiz, esquema: !!esq }, medir);

    // fondo y marco
    const g = ctx.createLinearGradient(0, 0, 0, T.H); g.addColorStop(0, c.bg1); g.addColorStop(1, c.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, T.W, T.H);
    ctx.strokeStyle = c.linea; ctx.lineWidth = 2; rr(ctx, 40, 40, T.W - 80, T.H - 80, 6); ctx.stroke();

    // marca y etiqueta
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = c.acento; ctx.font = `400 64px ${F_IDEA}`; ctx.fillText('§', T.MARGEN, 170);
    ctx.fillStyle = c.texto; ctx.font = `italic 400 40px ${F_IDEA}`; ctx.fillText('Mente fría', T.MARGEN + 56, 168);
    espaciado(ctx, 7); ctx.fillStyle = c.acento; ctx.font = `500 24px ${F_UI}`; ctx.fillText('IDEA', T.MARGEN, T.TOP - 28); espaciado(ctx, 0);
    ctx.fillStyle = c.acento; ctx.fillRect(T.MARGEN + 100, T.TOP - 36, 60, 2);

    // la idea
    let y = T.TOP + p.idea.fs;
    ctx.fillStyle = c.texto; ctx.font = `italic 400 ${p.idea.fs}px ${F_IDEA}`;
    p.idea.lineas.forEach(l => { ctx.fillText(l, T.MARGEN, y); y += p.idea.fs * p.idea.interlinea; });
    y = T.TOP + 20 + p.altoIdea + 30;

    // esquema (con su pie)
    if (esq) {
      const pw = T.ANCHO, ph = T.ALTO_ESQUEMA;
      ctx.fillStyle = c.panel; rr(ctx, T.MARGEN, y, pw, ph, 18); ctx.fill();
      ctx.strokeStyle = c.linea; ctx.lineWidth = 1.5; ctx.stroke();
      let yy = y + 44;
      if (esq.titulo) { espaciado(ctx, 3); ctx.fillStyle = c.acento; ctx.font = `500 22px ${F_UI}`; ctx.fillText(esq.titulo.toUpperCase().slice(0, 48), T.MARGEN + 30, yy); espaciado(ctx, 0); yy += 18; }
      const piePx = esq.pie ? Tarjeta.envolver(esq.pie, medirCon(ctx, F_TXT, 'italic 400'), 22, pw - 60, 2) : { lineas: [] };
      const altoPie = piePx.lineas.length ? piePx.lineas.length * 30 + 14 : 0;
      const libreH = ph - (yy - y) - altoPie - 18, libreW = pw - 60;
      const k = Math.min(libreW / esq.w, libreH / esq.h);
      const dw = esq.w * k, dh = esq.h * k;
      ctx.drawImage(esq.img, T.MARGEN + 30 + (libreW - dw) / 2, yy + (libreH - dh) / 2, dw, dh);
      ctx.fillStyle = c.tenue; ctx.font = `italic 400 22px ${F_TXT}`;
      piePx.lineas.forEach((l, i) => ctx.fillText(l, T.MARGEN + 30, y + ph - altoPie + 24 + i * 30));
      y += ph + 40;
    }

    // el matiz
    if (conMatiz && p.matiz.lineas.length) {
      y = T.PIE_TOP - 28 - p.matiz.alto;                       // anclado justo encima del pie
      ctx.strokeStyle = c.linea; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(T.MARGEN, y); ctx.lineTo(T.MARGEN + T.ANCHO, y); ctx.stroke();
      espaciado(ctx, 5); ctx.fillStyle = c.acento; ctx.font = `500 22px ${F_UI}`; ctx.fillText('EL MATIZ', T.MARGEN, y + 42); espaciado(ctx, 0);
      ctx.fillStyle = c.suave; ctx.font = `italic 400 ${p.matiz.fs}px ${F_TXT}`;
      p.matiz.lineas.forEach((l, i) => ctx.fillText(l, T.MARGEN, y + 90 + i * p.matiz.fs * p.matiz.interlinea));
    }

    // pie: libro, autor y dónde leerlo
    const py = T.PIE_TOP + 20;
    ctx.strokeStyle = c.linea; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(T.MARGEN, py - 28); ctx.lineTo(T.MARGEN + T.ANCHO, py - 28); ctx.stroke();
    const cortar = (t, fam, estilo, fs, max) => { let s = t; const m = medirCon(ctx, fam, estilo); while (s.length > 4 && m(s, fs) > max) s = s.slice(0, -2).trim(); return s === t ? t : s + '…'; };
    ctx.fillStyle = c.texto; ctx.font = `400 36px ${F_IDEA}`; ctx.fillText(cortar(libro ? libro.titulo : '', F_IDEA, '400', 36, T.ANCHO), T.MARGEN, py + 30);
    ctx.fillStyle = c.suave; ctx.font = `italic 400 28px ${F_TXT}`; ctx.fillText(cortar(libro && libro.autor ? libro.autor : '', F_TXT, 'italic 400', 28, T.ANCHO), T.MARGEN, py + 76);
    ctx.fillStyle = c.tenue; ctx.font = `400 24px ${F_UI}`; ctx.fillText(cortar('Lección: ' + (lec.titulo || ''), F_UI, '400', 24, T.ANCHO), T.MARGEN, py + 120);
    return p;
  }

  /* ── Ventana ── */
  function ventana() {
    let o = document.getElementById('tarjeta-overlay');
    if (o) return o;
    o = document.createElement('div');
    o.id = 'tarjeta-overlay'; o.className = 'tj-overlay'; o.hidden = true;
    o.innerHTML = `<div class="tj-fondo" onclick="TarjetaUI.cerrar()"></div>
      <div class="tj-hoja" role="dialog" aria-label="Compartir una idea">
        <div class="tj-cab"><span>Compartir esta idea</span><button type="button" class="tj-x" onclick="TarjetaUI.cerrar()" aria-label="Cerrar">✕</button></div>
        <div class="tj-prev"><canvas id="tj-canvas"></canvas></div>
        <div class="tj-opc">
          <div class="tj-seg" role="group" aria-label="Tema"><button type="button" data-t="oscuro" class="on" onclick="TarjetaUI.tema(false)">Oscuro</button><button type="button" data-t="claro" onclick="TarjetaUI.tema(true)">Claro</button></div>
          <div class="tj-seg" role="group" aria-label="Añadir"><button type="button" data-x="nada" class="on" onclick="TarjetaUI.extra('nada')">Solo la idea</button><button type="button" data-x="matiz" id="tj-b-matiz" onclick="TarjetaUI.extra('matiz')">+ Matiz</button><button type="button" data-x="esquema" id="tj-b-esq" onclick="TarjetaUI.extra('esquema')">+ Esquema</button></div>
        </div>
        <p class="tj-nota" id="tj-nota"></p>
        <div class="tj-acc"><button type="button" class="tj-go" onclick="TarjetaUI.compartir()">Compartir</button><button type="button" class="tj-ghost" onclick="TarjetaUI.descargar()">Descargar</button></div>
      </div>`;
    document.body.appendChild(o);
    canvas = o.querySelector('#tj-canvas');
    return o;
  }

  async function pintar() {
    const lec = lecs.find(l => l.id === est.lecId); if (!lec) return;
    const libro = libros.find(b => b.id === lec.libro_id);
    const n = ++pintando;
    const nota = document.getElementById('tj-nota');
    try {
      const p = await dibujar(canvas, lec, libro, est);
      if (n !== pintando) return;
      ultimo = p;
      nota.textContent = p.idea.recortado ? 'La idea es larga: la tarjeta lleva sus primeras frases.' : (p.origen === 'cuerpo' ? 'Esta lección no tiene idea clave: se usa el arranque del texto.' : '');
    } catch (e) { console.warn('tarjeta:', e); if (nota) nota.textContent = 'No se pudo dibujar la tarjeta.'; }
  }

  function abrir(lecId) {
    const lec = lecs.find(l => l.id === lecId); if (!lec) return;
    const o = ventana();
    est = { lecId, claro: false, extra: 'nada' };
    o.querySelectorAll('.tj-seg button').forEach(b => b.classList.toggle('on', b.dataset.t === 'oscuro'));
    o.querySelectorAll('[data-x]').forEach(b => b.classList.toggle('on', b.dataset.x === 'nada'));
    o.querySelector('#tj-b-matiz').hidden = !Tarjeta.matiz(lec, Tarjeta.MATIZ_MAX);
    o.querySelector('#tj-b-esq').hidden = !(typeof Diagrama !== 'undefined' && Diagrama.deLeccion(lec).length);
    o.hidden = false; document.body.classList.add('tj-abierta');
    pintar();
    if (typeof track === 'function') track('tarjeta', { accion: 'abrir' });
  }
  function cerrar() { const o = document.getElementById('tarjeta-overlay'); if (o) o.hidden = true; document.body.classList.remove('tj-abierta'); }
  function tema(claro) { est.claro = !!claro; document.querySelectorAll('#tarjeta-overlay [data-t]').forEach(b => b.classList.toggle('on', (b.dataset.t === 'claro') === est.claro)); pintar(); }
  function extra(x) { est.extra = x; document.querySelectorAll('#tarjeta-overlay [data-x]').forEach(b => b.classList.toggle('on', b.dataset.x === x)); pintar(); }

  const aBlob = () => new Promise(res => canvas.toBlob(b => res(b), 'image/png'));
  async function compartir() {
    const lec = lecs.find(l => l.id === est.lecId); if (!lec || !canvas) return;
    const blob = await aBlob(); if (!blob) { toast('No se pudo crear la imagen'); return; }
    const file = new File([blob], Tarjeta.nombreArchivo(lec), { type: 'image/png' });
    const url = typeof urlCarta === 'function' ? urlCarta(`leccion/${lec.libro_id}/${lec.id}`) : location.href;
    if (typeof track === 'function') track('tarjeta', { accion: 'compartir' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: lec.titulo, text: url }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    descargar();
    if (typeof copiarCarta === 'function') copiarCarta(url);
  }
  async function descargar() {
    const lec = lecs.find(l => l.id === est.lecId); if (!lec || !canvas) return;
    const blob = await aBlob(); if (!blob) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = Tarjeta.nombreArchivo(lec);
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(); });

  return { abrir, cerrar, tema, extra, compartir, descargar, dibujar, get ultimo() { return ultimo; } };
})();
