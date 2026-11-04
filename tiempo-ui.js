/* ═══════════════════════════════════════════
   TIEMPO REAL DE LECTURA — cuenta los segundos con una lección a la vista y los guarda por lección y día.
   Lógica pura y pruebas: lib/tiempo.js. Tabla: tiempo_lectura (supabase/migrations/20261104_tiempo_lectura.sql).
   Un segundo cuenta solo con la lección en pantalla, la pestaña visible y una interacción en los últimos 90 s.
   Usa los globales de app.js (lecActual, modoCarta, Dia, sb, SB_URL, SB_KEY, USUARIO_ID, Cuenta).
═══════════════════════════════════════════ */
const TiempoUI = (() => {
  let mapa = new Map(), sucias = new Set(), ultima = 0, cargado = false, enCurso = false;

  const dia = () => Dia.hoy();
  const interaccion = () => { ultima = Date.now(); };

  async function cargar() {
    try {
      const rows = await sb(`tiempo_lectura?select=leccion_id,dia,segundos&usuario_id=eq.${USUARIO_ID}`);
      mapa = Tiempo.deFilas(rows || []);
    } catch (e) { console.warn('Tiempo: sin tabla o sin conexión (no se mide)', e); return false; }
    cargado = true; return true;
  }

  function tick() {
    if (!cargado) return;
    const vista = document.getElementById('view-leccion');
    const ok = Tiempo.cuenta({
      enLeccion: !!(vista && vista.classList.contains('active') && lecActual),
      leccionId: lecActual && lecActual.id, visible: !document.hidden,
      ahora: Date.now(), ultimaInteraccion: ultima
    });
    if (ok && Tiempo.sumar(mapa, lecActual.id, dia())) sucias.add(Tiempo.clave(lecActual.id, dia()));
  }

  async function guardar() {
    if (!cargado || !sucias.size || enCurso) return;
    const claves = new Set(sucias); sucias.clear(); enCurso = true;
    try {
      const filas = Tiempo.filas(mapa, claves, USUARIO_ID);
      if (filas.length) await sb('tiempo_lectura?on_conflict=usuario_id,leccion_id,dia', { method: 'POST', body: JSON.stringify(filas), headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
    } catch (e) { claves.forEach(k => sucias.add(k)); console.warn('Tiempo: no se pudo guardar', e); }
    enCurso = false;
  }

  /** Al cerrar o ocultar la app no da tiempo a esperar: petición con keepalive y el token ya guardado. */
  function guardarAlSalir() {
    if (!cargado || !sucias.size) return;
    const filas = Tiempo.filas(mapa, sucias, USUARIO_ID); sucias.clear();
    if (!filas.length) return;
    try {
      const tok = (typeof Cuenta !== 'undefined' && Cuenta.tokenSync && Cuenta.tokenSync()) || SB_KEY;
      fetch(`${SB_URL}/rest/v1/tiempo_lectura?on_conflict=usuario_id,leccion_id,dia`, { method: 'POST', keepalive: true,
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(filas) }).catch(() => {});
    } catch (e) { /* sin red: se pierde como mucho el último tramo */ }
  }

  async function iniciar() {
    if (typeof modoCarta === 'function' && modoCarta()) return;       // enlaces compartidos: sin datos personales
    ['pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll', 'click'].forEach(ev => window.addEventListener(ev, interaccion, { passive: true, capture: true }));
    await cargar();
    setInterval(tick, 1000);
    setInterval(guardar, 20000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) guardarAlSalir(); });
    window.addEventListener('pagehide', guardarAlSalir);
  }

  /** Filas [{leccion_id, dia, segundos}] para «Tu estudio». */
  const datos = () => Array.from(mapa.entries()).map(([k, segundos]) => { const [leccion_id, d] = k.split('|'); return { leccion_id, dia: d, segundos }; });

  return { iniciar, datos, guardar, get activo() { return cargado; } };
})();
