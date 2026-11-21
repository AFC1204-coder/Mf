/* Remata el fotograma de una pieza compartible: acento del eje, silueta del esquema de la lección
   (lib/diagram.js), icono del mapa (lib/mapa.js) y ajuste para que nada se salga del escenario. */
(function () {
  'use strict';
  var st = window.__CS__ || {};
  var root = document.documentElement;
  var acento = (window.Mapa && window.Mapa.ACENTOS && window.Mapa.ACENTOS[st.eje]) || '#c9a84c';
  root.style.setProperty('--accent', acento);

  var stage = document.querySelector('.cs-stage');
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
    var trazo = iconos[el.getAttribute('data-icon')] || iconos.bombilla || '';
    el.innerHTML = '<svg viewBox="0 0 24 24">' + trazo + '</svg>';
  });

  function ajustar() {
    if (stage) {
      // Con el contenido centrado, lo que sobra por arriba no cuenta en scrollHeight: se mide alineado arriba.
      stage.classList.add('top');
      var base = parseFloat(getComputedStyle(stage).fontSize) || 10;
      var px = base;
      // 1) La silueta cede altura antes que la letra; 2) después, la letra, hasta el mínimo legible.
      var sil = stage.querySelector('.cs-sil');
      var alto = sil ? sil.clientHeight : 0, minAlto = alto * 0.55;
      while (sil && stage.scrollHeight > stage.clientHeight + 1 && alto > minAlto) {
        alto -= 12; sil.style.height = alto + 'px';
      }
      // También a lo ancho: una palabra muy larga en letra grande puede no caber en la línea.
      while ((stage.scrollHeight > stage.clientHeight + 1 || stage.scrollWidth > stage.clientWidth + 1) && px > base * MIN_ESCALA) {
        px -= 0.1;
        stage.style.fontSize = px + 'px';
      }
      var desborda = stage.scrollHeight > stage.clientHeight + 1 || stage.scrollWidth > stage.clientWidth + 1;
      if (!desborda) stage.classList.remove('top');
      root.dataset.escala = String(Math.round((px / base) * 100));
      root.dataset.desborda = desborda ? '1' : '0';
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
