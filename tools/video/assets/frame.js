/* Remata el fotograma en el navegador: color del eje, esquema de la lección (lib/diagram.js),
   iconos del mapa (lib/mapa.js) y ajuste de tamaño para que nada se salga del escenario. */
(function () {
  'use strict';
  var st = window.__VF__ || {};
  var root = document.documentElement;
  var acento = (window.Mapa && window.Mapa.ACENTOS && window.Mapa.ACENTOS[st.eje]) || '#c9a84c';
  root.style.setProperty('--accent', acento);

  var stage = document.querySelector('.vf-stage');

  /* Recorrido del esquema: la pieza de la que se habla se ilumina, las ya vistas se atenúan y las
     que faltan quedan tapadas. Se hace con velos encima de cada caja (rect.dg-box), sin tocar el
     dibujo: la figura no cambia de forma entre un paso y el siguiente. */
  function enfocar(svgEl, foco) {
    if (!svgEl || !foco) return;
    var NS = 'http://www.w3.org/2000/svg';
    var cajas = svgEl.querySelectorAll('rect.dg-box');
    for (var i = 0; i < cajas.length; i++) {
      var c = cajas[i];
      var velo = document.createElementNS(NS, 'rect');
      ['x', 'y', 'width', 'height', 'rx'].forEach(function (a) { velo.setAttribute(a, c.getAttribute(a)); });
      if (i >= foco.shown) {
        velo.setAttribute('fill', '#111111'); velo.setAttribute('opacity', '0.93');
        velo.setAttribute('stroke', '#3a3a3a'); velo.setAttribute('stroke-dasharray', '4 5');
      } else if (foco.active >= 0 && i !== foco.active) {
        velo.setAttribute('fill', '#111111'); velo.setAttribute('opacity', '0.55');
      } else if (i === foco.active) {
        velo.setAttribute('fill', 'none'); velo.setAttribute('stroke', acento); velo.setAttribute('stroke-width', '2.4');
      } else {
        continue;
      }
      svgEl.appendChild(velo);
    }
  }

  /* Esquema-guía: la figura de la lección convertida en silueta (sin texto) con una insignia numerada en cada
     pieza. La pieza activa se ilumina, las demás se atenúan y, al recordar, las que aún no se han revelado
     quedan tapadas. `order` dice qué caja del dibujo corresponde a cada pieza.
     Como no lleva texto, la silueta se estira para aprovechar el ancho (hasta 1,7 veces su proporción) y las
     insignias se dibujan con la escala compensada para que sigan siendo círculos legibles. */
  function siluetar(svgEl, e) {
    if (!svgEl) return;
    var NS = 'http://www.w3.org/2000/svg';
    var cont = svgEl.parentNode;
    var W = cont.clientWidth, H = cont.clientHeight;
    var vb = svgEl.viewBox.baseVal;
    if (!W || !H || !vb || !vb.width) return;
    svgEl.classList.add('vf-sil');
    svgEl.setAttribute('preserveAspectRatio', 'none');
    var w = Math.min(W, H * (vb.width / vb.height) * 1.7);
    svgEl.style.width = w + 'px'; svgEl.style.height = H + 'px'; svgEl.style.margin = '0 auto';
    var sx = w / vb.width, sy = H / vb.height;
    var R = 21;  // radio de la insignia en píxeles del fotograma
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
        velo.setAttribute('fill', '#111111'); velo.setAttribute('opacity', '0.97');
        velo.setAttribute('stroke', '#4a4a4a'); velo.setAttribute('stroke-dasharray', '6 6'); velo.setAttribute('stroke-width', '2');
      } else if (activa >= 0 && j !== activa) {
        velo.setAttribute('fill', '#111111'); velo.setAttribute('opacity', '0.66');
      } else if (j === activa) {
        velo.setAttribute('fill', acento); velo.setAttribute('fill-opacity', '0.14');
        velo.setAttribute('stroke', acento); velo.setAttribute('stroke-width', '5');
      } else { pinta = false; }
      if (pinta) svgEl.appendChild(velo);
      if (j >= visibles) continue;
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'vf-badge' + (j === activa ? ' on' : ''));
      g.setAttribute('transform', 'translate(' + (x + 6 / sx + R / sx) + ' ' + (y + 6 / sy + R / sy) + ') scale(' + (R / sx) + ' ' + (R / sy) + ')');
      var ci = document.createElementNS(NS, 'circle');
      ci.setAttribute('r', 1);
      var tx = document.createElementNS(NS, 'text');
      tx.setAttribute('class', 'vf-badge-t'); tx.setAttribute('y', 0.42); tx.setAttribute('font-size', 1.15);
      tx.textContent = String(j + 1);
      g.appendChild(ci); g.appendChild(tx);
      svgEl.appendChild(g);
    }
    root.dataset.piezas = String(cajas.length);
  }

  var host = document.getElementById('vf-dg');
  if (host) {
    var svg = (window.Diagrama && st.spec) ? window.Diagrama.svg(st.spec) : '';
    if (svg) {
      host.innerHTML = svg;
      root.dataset.diagrama = 'ok';
      if (!st.guide) enfocar(host.querySelector('svg'), st.focus);
    } else {
      host.remove();
      root.dataset.diagrama = 'falta';
    }
  }

  document.querySelectorAll('[data-icon]').forEach(function (el) {
    var iconos = (window.Mapa && window.Mapa.ICONOS) || {};
    var trazo = iconos[el.getAttribute('data-icon')] || iconos.bombilla || '';
    el.innerHTML = '<svg viewBox="0 0 24 24">' + trazo + '</svg>';
  });

  // El ajuste se hace con las tipografías ya cargadas: medir con la letra de reserva deja textos desbordados.
  function ajustar() {
  if (stage) {
    // Con el contenido centrado, lo que sobra por arriba no cuenta en scrollHeight: se mide alineado arriba.
    stage.classList.add('top');
    // 1) El esquema se encoge por su altura (mantiene proporción); 2) el resto, por el tamaño de letra.
    var el = host && host.querySelector('svg');
    var ancho = 100;
    while (el && stage.scrollHeight > stage.clientHeight + 1 && ancho > 45) {
      ancho -= 3;
      el.style.width = ancho + '%';
    }
    var px = parseFloat(getComputedStyle(stage).fontSize) || 12.6;
    var base = px;
    while (stage.scrollHeight > stage.clientHeight + 1 && px > base * 0.56) {
      px -= 0.2;
      stage.style.fontSize = px + 'px';
    }
    if (stage.scrollHeight <= stage.clientHeight + 1) stage.classList.remove('top');
    root.dataset.escala = String(Math.round((px / base) * 100));
    root.dataset.desborda = stage.scrollHeight > stage.clientHeight + 1 ? '1' : '0';
  }
    if (st.guide && host) siluetar(host.querySelector('svg'), st);
    root.dataset.listo = '1';
  }
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(ajustar, ajustar);
  } else {
    ajustar();
  }
})();
