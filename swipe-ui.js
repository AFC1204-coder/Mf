/* ═══════════════════════════════════════════
   DESLIZAR ENTRE PANTALLAS (móvil) — Hoy · Biblioteca · Consulta · Repaso · Tú.
   Un gesto horizontal claro, fuera de lo que ya se desplaza de lado, cambia de pantalla.
   Lógica pura y pruebas: lib/swipe.js. Usa showView de app.js.
═══════════════════════════════════════════ */
(function () {
  if (typeof Swipe === 'undefined') return;
  const IGNORAR = 'input,textarea,select,[contenteditable="true"],.mz-track,.dg,svg,table,pre,code,[data-no-swipe]';
  const VENTANAS = '.tconfig-overlay,.modal-overlay,.cuenta-overlay,#spotlight-overlay';
  let g = null;

  const vistaActual = () => {
    const v = document.querySelector('.view.active');
    return v && v.id ? v.id.replace(/^view-/, '') : '';
  };
  const hayVentana = () => [...document.querySelectorAll(VENTANAS)].some(el => {
    if (el.classList.contains('hidden') || el.hasAttribute('hidden')) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  });
  /** ¿El toque empezó en algo que se desplaza de lado o que usa el gesto por su cuenta? */
  function seDesplazaDeLado(el) {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.matches && n.matches(IGNORAR)) return true;
      const cs = getComputedStyle(n);
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 2) return true;
    }
    return false;
  }

  document.addEventListener('touchstart', e => {
    g = null;
    if (e.touches.length !== 1) return;
    if (document.body.classList.contains('en-sesion')) return;
    const t = e.touches[0];
    g = { x0: t.clientX, y0: t.clientY, t0: Date.now(), ignorado: seDesplazaDeLado(e.target) || hayVentana(), vista: vistaActual() };
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const s = g; g = null;
    if (!s || !e.changedTouches.length) return;
    const t = e.changedTouches[0];
    const r = Swipe.decidir({
      dx: t.clientX - s.x0, dy: t.clientY - s.y0, ms: Date.now() - s.t0,
      x0: s.x0, ancho: window.innerWidth, vista: s.vista, ignorado: s.ignorado
    });
    if (!r || vistaActual() !== s.vista || typeof showView !== 'function') return;
    showView(r.destino);
    const nueva = document.getElementById('view-' + r.destino);
    if (nueva) {
      nueva.classList.remove('sw-ent-sig', 'sw-ent-ant');
      void nueva.offsetWidth;
      nueva.classList.add(r.dir === 'sig' ? 'sw-ent-sig' : 'sw-ent-ant');
      setTimeout(() => nueva.classList.remove('sw-ent-sig', 'sw-ent-ant'), 320);
    }
    if (typeof track === 'function') track('deslizar', { de: s.vista, a: r.destino });
  }, { passive: true });

  document.addEventListener('touchcancel', () => { g = null; }, { passive: true });
})();
