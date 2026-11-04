/* ═══════════════════════════════════════════
   RETOS DE PENSAMIENTO — pantalla al final de la lección, repaso «¿sigues pensando lo mismo?»
   y registro de predicciones. Lógica pura y tests: lib/retos.js. Diseño: docs/retos-pensamiento.md
   Usa los globales de app.js (sb, libros, lecs, esc, toast, USUARIO_ID, verLeccion, renderSRSDashboard).
   Sin respuestas correctas ni nota: lo que se guarda es lo que el usuario piensa.
═══════════════════════════════════════════ */
const RetosUI = (() => {
  let retos = new Map();      // leccion_id → reto activo
  let resp = [];              // respuestas del usuario
  let saltados = new Set();   // «Saltar» solo dura mientras la app está abierta: no se guarda ni se castiga
  let formNuevo = new Set();  // lecciones donde se está escribiendo una respuesta nueva
  let cargado = false;

  const leccion = id => (typeof lecs !== 'undefined' ? lecs : []).find(l => l.id === id);
  const libroDe = id => { const l = leccion(id); return l && (libros || []).find(b => b.id === l.libro_id); };
  const info = id => ({ autor: (libroDe(id) || {}).autor, idea: (leccion(id) || {}).titulo });
  const porId = id => resp.find(r => r.id === id);
  const ultimaDe = lecId => resp.filter(r => r.leccion_id === lecId && r.tipo !== 'explicalo')
    .sort((a, b) => new Date(b.creada_at) - new Date(a.creada_at))[0];

  async function cargar() {
    try {
      const [rs, ps] = await Promise.all([
        sb('retos?select=id,leccion_id,libro_id,tipo,texto,leccion_contraste_id&activo=eq.true'),
        sb(`respuestas_reto?select=*&usuario_id=eq.${USUARIO_ID}&order=creada_at.asc`)
      ]);
      retos = new Map((rs || []).map(r => [r.leccion_id, r]));
      resp = ps || [];
    } catch (e) { console.warn('Retos: sin conexión o sin migración', e); }
    cargado = true;
    refrescarLeccionAbierta();
  }
  function refrescarLeccionAbierta() {
    const el = document.querySelector('#leccion-contenido [data-reto-lec]');
    if (el) sustituir(el.dataset.retoLec);
  }
  /** ¿Esta lección tiene reto activo? (entonces el test antiguo se oculta) */
  // (en modo invitado no hay dónde guardar: se queda el test de siempre)
  const tiene = lecId => retos.has(lecId) && !(typeof modoCarta === 'function' && modoCarta());

  /* ── Pantalla al final de la lección ── */
  function html(lec) {
    const r = retos.get(lec.id);
    return r ? `<section class="reto" data-reto-lec="${lec.id}">${interior(lec.id)}</section>` : '';
  }
  function interior(lecId) {
    const r = retos.get(lecId); if (!r) return '';
    const T = Retos.TIPOS[r.tipo];
    const ult = ultimaDe(lecId);
    const contr = r.tipo === 'choque' && r.leccion_contraste_id ? leccion(r.leccion_contraste_id) : null;
    const cab = `<div class="reto-label">Reto · ${esc(T.nombre)}</div>
      <div class="reto-q">${esc(r.texto)}</div>
      ${contr ? `<div class="reto-contr">Contrasta con «${esc(contr.titulo)}»${(libroDe(contr.id) || {}).autor ? ' · ' + esc(libroDe(contr.id).autor) : ''}</div>` : ''}`;
    if (saltados.has(lecId) && !ult) {
      return `${cab}<div class="reto-hecho">Lo dejas para otra vez. <button type="button" class="reto-link" onclick="RetosUI.reabrir('${lecId}')">Contestar ahora</button></div>${explicalo(lecId)}`;
    }
    if (ult && !formNuevo.has(lecId)) {
      const cuando = Retos.hace(ult.creada_at);
      const dias = Math.max(1, Math.round((new Date(ult.proxima_revision) - Date.now()) / 86400000));
      const aviso = ult.tipo === 'predecir' && !ult.resuelta_at
        ? `Volveré a preguntarte si acertaste, en unos ${dias} días.`
        : 'Te lo volveré a enseñar dentro de un tiempo para ver si sigues pensando lo mismo.';
      return `${cab}<div class="reto-mia"><div class="reto-mia-cab">Tu respuesta · ${cuando}</div><div class="reto-mia-txt">${esc(ult.texto)}</div></div>
        <div class="reto-hecho">${aviso} <button type="button" class="reto-link" onclick="RetosUI.otra('${lecId}')">Escribir otra</button></div>${explicalo(lecId)}`;
    }
    return `${cab}
      <textarea class="reto-area" id="reto-t-${lecId}" rows="3" maxlength="2000" aria-label="Tu respuesta" placeholder="Una a tres líneas. No hay respuesta correcta."></textarea>
      <div class="reto-acc">
        <button type="button" class="reto-btn" onclick="RetosUI.guardar('${lecId}')">Guardar</button>
        <button type="button" class="reto-btn sec" onclick="RetosUI.saltar('${lecId}')">Saltar</button>
        <span class="reto-ayuda">${esc(T.ayuda)}</span>
      </div>${explicalo(lecId)}`;
  }
  function explicalo(lecId) {
    const n = resp.filter(r => r.leccion_id === lecId && r.tipo === 'explicalo').length;
    return `<details class="reto-exp"><summary>Explícalo con tus palabras <small>(opcional${n ? ' · ' + n + ' guardada' + (n > 1 ? 's' : '') : ''})</small></summary>
      <textarea class="reto-area" id="reto-e-${lecId}" rows="4" maxlength="2000" aria-label="Explícalo con tus palabras" placeholder="Como se lo explicarías a alguien que no lo ha leído."></textarea>
      <div class="reto-acc">
        ${dictadoDisponible() ? `<button type="button" class="reto-btn sec" onclick="RetosUI.dictar(this,'reto-e-${lecId}')">🎙 Dictar</button>` : ''}
        <button type="button" class="reto-btn" onclick="RetosUI.guardarExplicalo('${lecId}')">Guardar</button>
      </div></details>`;
  }
  function sustituir(lecId) {
    const el = document.querySelector(`[data-reto-lec="${lecId}"]`);
    if (el) el.innerHTML = interior(lecId);
  }
  async function guardar(lecId) {
    const r = retos.get(lecId); const ta = document.getElementById('reto-t-' + lecId);
    const fila = r && ta && Retos.nuevaRespuesta({ tipo: r.tipo, texto: ta.value, leccion_id: lecId, reto_id: r.id });
    if (!fila) { toast('Escribe algo, aunque sea una línea (o pulsa Saltar)'); return; }
    await insertar(fila, lecId);
  }
  async function guardarExplicalo(lecId) {
    const ta = document.getElementById('reto-e-' + lecId);
    const fila = ta && Retos.nuevaRespuesta({ tipo: 'explicalo', texto: ta.value, leccion_id: lecId });
    if (!fila) { toast('Escribe algo primero'); return; }
    await insertar(fila, lecId);
  }
  async function insertar(fila, lecId) {
    try {
      const [creada] = await sb('respuestas_reto', { method: 'POST', body: JSON.stringify({ ...fila, usuario_id: USUARIO_ID }) });
      resp.push(creada || fila);
      if (fila.tipo !== 'explicalo') { saltados.delete(lecId); formNuevo.delete(lecId); }
      toast('Guardado');
      sustituir(lecId);
    } catch (e) { console.warn(e); toast('No se pudo guardar. Prueba de nuevo.'); }
  }
  function saltar(lecId) { saltados.add(lecId); sustituir(lecId); }
  function reabrir(lecId) { saltados.delete(lecId); sustituir(lecId); }
  function otra(lecId) { formNuevo.add(lecId); sustituir(lecId); }

  /* ── Dictado por voz (opcional; solo si el navegador lo trae) ── */
  const SR = () => (typeof window !== 'undefined') && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const dictadoDisponible = () => !!SR();
  let rec = null;
  function dictar(btn, taId) {
    const S = SR(); const ta = document.getElementById(taId); if (!S || !ta) return;
    if (rec) { try { rec.stop(); } catch (e) {} rec = null; btn.textContent = '🎙 Dictar'; return; }
    rec = new S(); rec.lang = 'es-ES'; rec.interimResults = false; rec.continuous = true;
    rec.onresult = ev => { for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) ta.value = (ta.value ? ta.value + ' ' : '') + ev.results[i][0].transcript.trim(); };
    rec.onend = () => { rec = null; btn.textContent = '🎙 Dictar'; };
    rec.onerror = () => { rec = null; btn.textContent = '🎙 Dictar'; toast('No se pudo usar el micrófono'); };
    btn.textContent = '■ Parar'; rec.start();
  }

  /* ── Repaso: «¿sigues pensando lo mismo?» y predicciones por comprobar ── */
  function bloqueRepaso() {
    const p = Retos.pendientes(resp);
    const n = p.predicciones.length + p.reflexiones.length;
    const hayPred = resp.some(r => r.tipo === 'predecir');
    if (!n && !hayPred && !resp.length) return '';
    const cab = `<div class="retos-rep"><p class="sec-label" style="margin-bottom:0.8rem">Retos de pensamiento</p>`;
    const tarjeta = n ? tarjetaPendiente(p.predicciones[0] || p.reflexiones[0], n)
      : '<p class="retos-nada">Nada que revisar hoy.</p>';
    return `${cab}${tarjeta}${hayPred ? '<button type="button" class="act-btn secondary" onclick="RetosUI.verRegistro(\'autor\')">Registro de predicciones</button>' : ''}</div>`;
  }
  function tarjetaPendiente(r, restantes) {
    const l = leccion(r.leccion_id) || {};
    const reto = (retos.get(r.leccion_id) || {}).texto;
    const cuerpo = `<div class="retos-card" data-resp="${r.id}">
      <div class="retos-card-n">${restantes > 1 ? restantes + ' por revisar' : '1 por revisar'} · ${esc(l.titulo || '')}</div>
      ${reto ? `<div class="retos-card-q">${esc(reto)}</div>` : ''}
      <div class="reto-mia"><div class="reto-mia-cab">${r.tipo === 'predecir' ? 'Predijiste' : 'Escribiste'} · ${Retos.hace(r.creada_at)}</div><div class="reto-mia-txt">${esc(r.texto)}</div></div>`;
    if (r.tipo === 'predecir') {
      return cuerpo + `<div class="retos-preg">¿Acertaste?</div><div class="retos-bot">
        <button type="button" class="reto-btn" onclick="RetosUI.resolver('${r.id}','acerto')">Sí</button>
        <button type="button" class="reto-btn" onclick="RetosUI.resolver('${r.id}','fallo')">No</button>
        <button type="button" class="reto-btn" onclick="RetosUI.resolver('${r.id}','a_medias')">A medias</button>
        <button type="button" class="reto-btn sec" onclick="RetosUI.resolver('${r.id}','aun_no')">Aún no se sabe</button></div></div>`;
    }
    return cuerpo + `<div class="retos-preg">¿Sigues pensando lo mismo?</div><div class="retos-bot">
      <button type="button" class="reto-btn" onclick="RetosUI.revisar('${r.id}','igual')">Lo mismo</button>
      <button type="button" class="reto-btn" onclick="RetosUI.pedirTexto('${r.id}','matizo')">Con matices</button>
      <button type="button" class="reto-btn" onclick="RetosUI.pedirTexto('${r.id}','cambio')">He cambiado</button></div>
      <div class="retos-extra"></div></div>`;
  }
  function pedirTexto(id, veredicto) {
    const c = document.querySelector(`[data-resp="${id}"] .retos-extra`); if (!c) return;
    c.innerHTML = `<textarea class="reto-area" id="retos-rev-t" rows="3" maxlength="2000" placeholder="${veredicto === 'cambio' ? 'Qué piensas ahora (opcional)' : 'Qué matizarías (opcional)'}"></textarea>
      <div class="reto-acc"><button type="button" class="reto-btn" onclick="RetosUI.revisar('${id}','${veredicto}')">Guardar</button></div>`;
    document.getElementById('retos-rev-t').focus();
  }
  async function revisar(id, veredicto) {
    const r = porId(id); if (!r) return;
    const ta = document.getElementById('retos-rev-t');
    const texto = ta ? Retos.limpiarTexto(ta.value) : null;
    const cambio = Retos.trasRevision(r, veredicto);
    if (!cambio) return;
    try {
      await sb(`respuestas_reto?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(cambio) });
      await sb('revisiones_reto', { method: 'POST', body: JSON.stringify({ usuario_id: USUARIO_ID, respuesta_id: id, veredicto, texto }) });
      Object.assign(r, cambio);
      repintar();
    } catch (e) { console.warn(e); toast('No se pudo guardar. Prueba de nuevo.'); }
  }
  async function resolver(id, resultado) {
    const r = porId(id); if (!r) return;
    const cambio = Retos.resolverPrediccion(r, resultado); if (!cambio) return;
    try {
      await sb(`respuestas_reto?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(cambio) });
      Object.assign(r, cambio);
      repintar();
    } catch (e) { console.warn(e); toast('No se pudo guardar. Prueba de nuevo.'); }
  }
  function repintar() { if (typeof renderSRSDashboard === 'function') renderSRSDashboard(); }

  /* ── Registro de predicciones por autor o por idea ── */
  const ETQ = { acerto: 'Acertó', fallo: 'Falló', a_medias: 'A medias' };
  function verRegistro(por) {
    const root = document.getElementById('srs-root'); if (!root) return;
    const grupos = Retos.registro(resp, info, por);
    const total = grupos.reduce((s, g) => s + g.items.length, 0);
    const cerradas = grupos.reduce((s, g) => s + g.acerto + g.fallo + g.a_medias, 0);
    root.innerHTML = `<button class="back-btn" onclick="renderSRSDashboard()">← Repaso</button>
      <h1 class="page-title" style="margin-bottom:0.3rem">Tus predicciones</h1>
      <p class="page-sub" style="margin-bottom:1rem">${total} en total · ${cerradas} ya comprobadas.${cerradas < 5 ? ' Con tan pocas todavía no dicen nada fiable.' : ''}</p>
      <div class="srs-modo-row" style="margin-bottom:1.2rem">
        <button class="srs-modo-btn ${por === 'autor' ? 'active' : ''}" onclick="RetosUI.verRegistro('autor')">Por autor</button>
        <button class="srs-modo-btn ${por === 'idea' ? 'active' : ''}" onclick="RetosUI.verRegistro('idea')">Por idea</button>
      </div>
      ${grupos.map(g => `<div class="retos-grupo"><div class="retos-grupo-t">${esc(g.clave)}</div>
        <div class="retos-grupo-c">Acertadas ${g.acerto} · Falladas ${g.fallo} · A medias ${g.a_medias} · Pendientes ${g.pendientes}</div>
        ${g.items.map(i => `<div class="retos-item"><div class="retos-item-m">${esc((leccion(i.leccion_id) || {}).titulo || '')} · ${Retos.ymd(i.creada_at)} · <strong>${ETQ[i.resultado] || 'Pendiente'}</strong></div><div>${esc(i.texto)}</div></div>`).join('')}
      </div>`).join('') || '<p class="retos-nada">Aún no has hecho ninguna predicción.</p>'}`;
  }

  const datos = () => ({ respuestas: resp, activos: retos.size });

  return { cargar, html, tiene, datos, guardar, guardarExplicalo, saltar, reabrir, otra, dictar, bloqueRepaso,
    pedirTexto, revisar, resolver, verRegistro, get cargado() { return cargado; } };
})();
