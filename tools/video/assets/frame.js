/* Remata el fotograma en el navegador: color del eje, esquema de la lección (lib/diagram.js),
   iconos del mapa (lib/mapa.js) y ajuste de tamaño para que nada se salga del escenario. */
(function () {
  'use strict';
  var st = window.__VF__ || {};
  var root = document.documentElement;
  var acento = (window.Mapa && window.Mapa.ACENTOS && window.Mapa.ACENTOS[st.eje]) || '#c9a84c';
  root.style.setProperty('--accent', acento);

  var stage = document.querySelector('.vf-stage');

  var host = document.getElementById('vf-dg');
  if (host) {
    var svg = (window.Diagrama && st.spec) ? window.Diagrama.svg(st.spec) : '';
    if (svg) {
      host.innerHTML = svg;
      root.dataset.diagrama = 'ok';
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
})();
