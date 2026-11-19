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

  var host = document.getElementById('vf-dg');
  if (host) {
    var svg = (window.Diagrama && st.spec) ? window.Diagrama.svg(st.spec) : '';
    if (svg) {
      host.innerHTML = svg;
      root.dataset.diagrama = 'ok';
      enfocar(host.querySelector('svg'), st.focus);
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
    root.dataset.listo = '1';
  }
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(ajustar, ajustar);
  } else {
    ajustar();
  }
})();
