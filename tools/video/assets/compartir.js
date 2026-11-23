/* Remata el fotograma de una pieza compartible: acento del eje, silueta del esquema de la lección
   (lib/diagram.js), icono del mapa (lib/mapa.js) y ajuste para que nada se salga del escenario. */
(function () {
  'use strict';
  var st = window.__CS__ || {};
  var root = document.documentElement;
  var acento = (window.Mapa && window.Mapa.ACENTOS && window.Mapa.ACENTOS[st.eje]) || '#c9a84c';
  root.style.setProperty('--accent', acento);

  var stage = document.querySelector('.cs-stage:not(.cs-fantasma)');
  var MIN_ESCALA = 0.68;  // por debajo, la letra más pequeña del escenario bajaría de 30 px

  /* La figura de la lección, sin texto: la forma queda como orientación y cada pieza lleva una insignia
     numerada. La pieza activa se ilumina, las ya vistas se atenúan y las que faltan quedan tapadas.
     El texto de la pieza va aparte, en grande: a 1080 px de ancho, dentro del dibujo no se leería. */
  function siluetar(svgEl, e) {
    if (!svgEl) return;
    var NS = 'http://www.w3.org/2000/svg';
    var cont = svgEl.parentNode;
    var W = cont.clientWidth, H = cont.clientHeight;
    var vb = svgEl.viewBox.baseVal;
    if (!W || !H || !vb || !vb.width) return;
    svgEl.classList.add('cs-silueta');
    svgEl.setAttribute('preserveAspectRatio', 'none');
    var w = Math.min(W, H * (vb.width / vb.height) * 1.7);
    svgEl.style.width = w + 'px'; svgEl.style.height = H + 'px'; svgEl.style.margin = '0 auto';
    var sx = w / vb.width, sy = H / vb.height;
    var R = 29;  // radio de la insignia: su número mide ~33 px
    var cajas = svgEl.querySelectorAll('rect.dg-box');
    var n = e.n || 0, orden = e.order || [];
    var activa = (typeof e.active === 'number') ? e.active : -1;
    var visibles = (typeof e.shown === 'number') ? e.shown : n;
    for (var j = 0; j < n; j++) {
      var c = cajas[orden[j] != null ? orden[j] : j];
      if (!c) continue;
      var x = parseFloat(c.getAttribute('x')), y = parseFloat(c.getAttribute('y'));
      var velo = document.createElementNS(NS, 'rect');
      ['x', 'y', 'width', 'height', 'rx'].forEach(function (a) { velo.setAttribute(a, c.getAttribute(a)); });
      var pinta = true;
      if (j >= visibles) {
        velo.setAttribute('fill', '#0f0f11'); velo.setAttribute('opacity', '0.97');
        velo.setAttribute('stroke', '#4a4a4a'); velo.setAttribute('stroke-dasharray', '7 7'); velo.setAttribute('stroke-width', '2');
      } else if (activa >= 0 && j !== activa) {
        velo.setAttribute('fill', '#0a0a0b'); velo.setAttribute('opacity', '0.62');
      } else if (j === activa) {
        velo.setAttribute('fill', acento); velo.setAttribute('fill-opacity', '0.2');
        velo.setAttribute('stroke', acento); velo.setAttribute('stroke-width', '6');
      } else { pinta = false; }
      if (pinta) svgEl.appendChild(velo);
      if (j >= visibles) continue;
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'cs-badge' + (j === activa ? ' on' : ''));
      g.setAttribute('transform', 'translate(' + (x + 8 / sx + R / sx) + ' ' + (y + 8 / sy + R / sy) + ') scale(' + (R / sx) + ' ' + (R / sy) + ')');
      var ci = document.createElementNS(NS, 'circle');
      ci.setAttribute('r', 1);
      var tx = document.createElementNS(NS, 'text');
      tx.setAttribute('class', 'cs-badge-t'); tx.setAttribute('y', 0.42); tx.setAttribute('font-size', 1.15);
      tx.textContent = String(j + 1);
      g.appendChild(ci); g.appendChild(tx);
      svgEl.appendChild(g);
    }
    root.dataset.piezas = String(cajas.length);
  }

  var host = document.getElementById('cs-dg');
  if (host) {
    var svg = (window.Diagrama && st.spec) ? window.Diagrama.svg(st.spec) : '';
    if (svg) { host.innerHTML = svg; root.dataset.diagrama = 'ok'; }
    else { var caja = host.closest('.cs-sil'); if (caja) caja.remove(); root.dataset.diagrama = 'falta'; }
  }

  document.querySelectorAll('[data-icon]').forEach(function (el) {
    var iconos = (window.Mapa && window.Mapa.ICONOS) || {};
    var nombre = el.getAttribute('data-icon') || '';
    // «lu-…»: iconos de Lucide (iconos-lucide.js). Los demás, los 18 de la biblioteca de la app (lib/mapa.js).
    var trazo = (nombre.indexOf('lu-') === 0 && (window.CS_LUCIDE || {})[nombre.slice(3)]) || iconos[nombre] || iconos.bombilla || '';
    el.innerHTML = '<svg viewBox="0 0 24 24">' + trazo + '</svg>';
  });

  /* Encaja un escenario: la silueta cede altura antes que la letra; después, la letra, hasta el mínimo legible. */
  function encajar(esc) {
    // Con el contenido centrado, lo que sobra por arriba no cuenta en scrollHeight: se mide alineado arriba.
    esc.classList.add('top');
    var base = parseFloat(getComputedStyle(esc).fontSize) || 10;
    var px = base;
    var sil = esc.querySelector('.cs-sil');
    var alto = sil ? sil.clientHeight : 0, minAlto = alto * 0.55;
    while (sil && esc.scrollHeight > esc.clientHeight + 1 && alto > minAlto) {
      alto -= 12; sil.style.height = alto + 'px';
    }
    // También a lo ancho: una palabra muy larga en letra grande puede no caber en la línea.
    while ((esc.scrollHeight > esc.clientHeight + 1 || esc.scrollWidth > esc.clientWidth + 1) && px > base * MIN_ESCALA) {
      px -= 0.1;
      esc.style.fontSize = px + 'px';
    }
    var desborda = esc.scrollHeight > esc.clientHeight + 1 || esc.scrollWidth > esc.clientWidth + 1;
    if (!desborda) esc.classList.remove('top');
    return { escala: Math.round((px / base) * 100), desborda: desborda };
  }

  /* Fotograma intermedio de un esquema que cambia de pieza: el documento trae, invisible, el estado del que se
     viene (.cs-fantasma). Cada panel sale de donde estaba y llega a donde va (st.tween: 0 = origen, 1 = destino);
     el que se abre crece hacia abajo y su texto nuevo aparece al final. El contenido no cambia: solo se mueve. */
  function mover(fantasma, t) {
    var antes = fantasma.querySelectorAll('.cs-pan'), ahora = stage.querySelectorAll('.cs-pan');
    if (!antes.length || antes.length !== ahora.length) return;
    var s = 1 - Math.pow(1 - t, 3);  // sale deprisa y frena
    for (var k = 0; k < ahora.length; k++) {
      var a = antes[k].getBoundingClientRect(), b = ahora[k].getBoundingClientRect();
      var dy = (a.top - b.top) * (1 - s), dx = (a.left - b.left) * (1 - s);
      ahora[k].style.transform = 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px)';
      if (b.height > a.height + 2) {
        var falta = (b.height - a.height) * (1 - s);
        ahora[k].style.clipPath = 'inset(0 0 ' + falta.toFixed(2) + 'px 0 round 30px)';
        var extra = ahora[k].querySelectorAll('span, ul');
        for (var e = 0; e < extra.length; e++) extra[e].style.opacity = String(Math.max(0, (s - 0.45) / 0.55));
      }
    }
  }

  function ajustar() {
    if (stage) {
      var r = encajar(stage);
      root.dataset.escala = String(r.escala);
      root.dataset.desborda = r.desborda ? '1' : '0';
      var fantasma = document.querySelector('.cs-fantasma');
      if (fantasma && typeof st.tween === 'number') { encajar(fantasma); mover(fantasma, st.tween); }
    }
    if (host && host.querySelector('svg')) siluetar(host.querySelector('svg'), st);
    root.dataset.listo = '1';
  }
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(ajustar, ajustar);
  } else {
    ajustar();
  }
})();
