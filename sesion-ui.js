/* ═══════════════════════════════════════════
   SESIÓN DE HOY — Recuerda → Lee → Comprueba → Lleva
   Usa los globales de app.js (libros, lecs, preg, prog, srsRPC, fmt, esc…).
   Lógica pura y tests: lib/sesion.js · diseño: docs/rediseno-uso-diario.md §3
═══════════════════════════════════════════ */

/* ── Eventos de uso (línea base de métricas) ──
   Cola en localStorage: si la tabla `eventos` no existe o no hay red, no pasa nada. */
const EV_Q = 'scs2_ev_q';
let evOff = false, evBusy = false;

function track(tipo, props) {
  try {
    const q = LS.get(EV_Q, []);
    q.push({ usuario_id: 'default', ts: new Date().toISOString(), dia: Dia.hoy(), tipo, props: props || {} });
    LS.set(EV_Q, q.slice(-200));
  } catch (e) { return; }
  flushEventos();
}
async function flushEventos() {
  if (evOff || evBusy) return;
  const q = LS.get(EV_Q, []);
  if (!q.length) return;
  evBusy = true;
  try {
    await sb('eventos', { method: 'POST', body: JSON.stringify(q) });
    LS.set(EV_Q, LS.get(EV_Q, []).slice(q.length));
  } catch (e) {
    // Tabla aún sin crear: se deja de intentar en esta carga; la cola espera.
    if (/PGRST205|42P01|does not exist|Could not find|not find the table/i.test(String(e.message))) evOff = true;
  } finally { evBusy = false; }
}

/* ── Estado ── */
const SES_HOY_K = 'scs2_sesion_hoy';
const SES_MODO_K = 'scs2_modo_lectura';
let ses = null;
let sesPrecarga = { tarjetas: [], compromiso: null, listo: false };

const sesModoLectura = () => (LS.get(SES_MODO_K, 'corta') === 'completa' ? 'completa' : 'corta');

async function sesPrecargar() {
  let tarjetas = [], compromiso = null;
  try { tarjetas = (await srsRPC('obtener_cola_repaso', { p_usuario: SRS_USER, p_modo: null, p_limite: Sesion.MAX_TARJETAS })) || []; } catch (e) {}
  try {
    const r = await sb(`compromisos?usuario_id=eq.${SRS_USER}&resultado=is.null&para=lte.${Dia.hoy()}&order=created_at.asc&limit=1`);
    compromiso = (r && r[0]) || null;
  } catch (e) {}
  sesPrecarga = { tarjetas, compromiso, listo: true };
  renderAtril();
}

function sesLeccionHoy() {
  const hilo = getHilo();
  const comp = completadasSet();
  if (hilo && hilo.nextId && hiloValido(hilo)) {
    const l = lecs.find(x => x.id === hilo.nextId);
    if (l && !comp.has(l.id)) return l;
  }
  return pickNocheLeccion();
}

function sesPlan(solo) {
  const lec = solo ? null : sesLeccionHoy();
  const minCompleta = lec ? Didactica.minutosLectura(lec) : 0;
  const pregunta = lec ? (Didactica.preguntasParaLeccion(lec, preg, 1)[0] || null) : null;
  const plan = Sesion.construir({
    tarjetas: sesPrecarga.tarjetas,
    compromiso: sesPrecarga.compromiso,
    leccion: lec,
    pregunta,
    tieneAccion: !!(lec && (lec.aplicacion_practica || '').trim()),
    modo: sesModoLectura(),
    minCompleta
  });
  return { lec, pregunta, plan, minCompleta };
}

/* ── Tarjeta «Hoy» del atril ── */
function sesionCardHtml() {
  const { lec, plan } = sesPlan(false);
  if (plan.vacia) return '';
  const libro = lec ? libros.find(l => l.id === lec.libro_id) : null;
  const ruta = rutaActivaItems();
  const det = {
    recuerda: p => `${p.n} ${p.n === 1 ? 'idea de antes' : 'ideas de antes'}`,
    lee: p => `${lec ? esc(lec.titulo) : ''} · ${p.min} min`,
    comprueba: () => 'una pregunta',
    lleva: () => 'una acción'
  };
  const items = plan.pasos.map(p => `<li><b>${p.etiqueta}</b><span>${det[p.k](p)}</span></li>`).join('');
  const solo = sesPrecarga.tarjetas.length && lec
    ? `<button type="button" class="atril-ghost" onclick="sesionEmpezar(true)">Solo recordar</button>` : '';
  return `<div class="ses-card">
    <p class="ses-card-k">Hoy · ${plan.minutos} min${ruta ? ' · ' + esc(ruta.titulo) + ' ' + ruta.pct + '%' : (libro ? ' · ' + esc(libro.titulo) : '')}</p>
    <ol class="ses-pasos">${items}</ol>
    <div class="atril-actions">
      <button type="button" class="atril-open" onclick="sesionEmpezar(false)">Empezar</button>${solo}
    </div>
  </div>`;
}

function sesionResumenHoy() {
  const h = LS.get(SES_HOY_K, null);
  return h && h.dia === Dia.hoy() ? h : null;
}

/* ── Flujo ── */
function sesionEmpezar(solo) {
  if (Ambiente.wanted()) Ambiente.start();
  const { lec, pregunta, plan } = sesPlan(!!solo);
  if (plan.vacia) { toast('Hoy no queda nada pendiente'); return; }
  const recuerdaItems = [];
  if (sesPrecarga.compromiso) recuerdaItems.push({ tipo: 'compromiso', c: sesPrecarga.compromiso });
  sesPrecarga.tarjetas.slice(0, Sesion.MAX_TARJETAS).forEach(t => recuerdaItems.push({ tipo: 'tarjeta', t }));
  ses = {
    plan, lec, pregunta, solo: !!solo,
    items: recuerdaItems, ri: 0,
    paso: 0, acc: null, nota: '',
    resumen: { recordadas: 0, leida: false, accion: false },
    t0: Date.now()
  };
  track('sesion_inicio', { pasos: plan.pasos.map(p => p.k), solo: !!solo, minutos: plan.minutos });
  showView('sesion');
  sesionRender();
}

function sesionBarra() {
  const pasos = ses.plan.pasos;
  const seg = pasos.map((p, i) => `<i class="${i < ses.paso ? 'hecho' : i === ses.paso ? 'on' : ''}" title="${p.etiqueta}"></i>`).join('');
  return `<div class="ses-bar">
    <button type="button" class="back-btn" onclick="sesionSalir()">Salir</button>
    <div class="ses-seg">${seg}</div>
    <span class="ses-cuenta">${Math.min(ses.paso + 1, pasos.length)}/${pasos.length}</span>
  </div>`;
}

function sesionSalir() {
  if (ses && !ses.cerrada) track('sesion_abandonada', { paso: ses.plan.pasos[ses.paso]?.k || 'fin', segundos: Math.round((Date.now() - ses.t0) / 1000) });
  ses = null;
  showView('home');
}

function sesionRender() {
  const root = document.getElementById('sesion-root');
  if (!root || !ses) return;
  const p = ses.plan.pasos[ses.paso];
  if (!p) { sesionFin(); return; }
  const fn = { recuerda: sesionRecuerda, lee: sesionLee, comprueba: sesionComprueba, lleva: sesionLleva }[p.k];
  root.innerHTML = sesionBarra() + `<div class="ses-body" id="ses-body"></div>`;
  fn(document.getElementById('ses-body'));
  window.scrollTo(0, 0);
}

function sesionSiguientePaso() {
  track('paso_hecho', { paso: ses.plan.pasos[ses.paso]?.k });
  ses.paso++;
  sesionRender();
}

/* ── Paso 1 · Recuerda ── */
function sesionRecuerda(body) {
  const it = ses.items[ses.ri];
  if (!it) { sesionSiguientePaso(); return; }
  const cuenta = `<p class="ses-kicker">Recuerda · ${ses.ri + 1} de ${ses.items.length}</p>`;
  if (it.tipo === 'compromiso') {
    body.innerHTML = `${cuenta}
      <h2 class="ses-title">Te llevaste una acción</h2>
      <blockquote class="ses-cita">${esc(it.c.texto)}</blockquote>
      <p class="ses-sub">¿La hiciste?</p>
      <div class="ses-opciones">
        <button type="button" class="ses-chip" onclick="sesionCompromiso('si')">Sí</button>
        <button type="button" class="ses-chip" onclick="sesionCompromiso('a_medias')">A medias</button>
        <button type="button" class="ses-chip" onclick="sesionCompromiso('no')">No tocó</button>
      </div>`;
    return;
  }
  const t = it.t;
  if (t.modo === 'quiz') {
    const ops = t.opciones || [];
    body.innerHTML = `${cuenta}
      <div class="srs-contexto">${esc(t.libro_titulo || '')} · <em>${esc(t.libro_autor || '')}</em></div>
      <div class="preg-card">
        <div class="preg-txt">${esc(t.pregunta_texto || '')}</div>
        <div class="opts-grid" id="ses-opts">
          ${ops.map((o, i) => `<button type="button" class="opt-btn" onclick="sesionTarjetaQuiz(${i})"><span class="opt-letter">${['A', 'B', 'C', 'D'][i] || ''}</span>${esc(o)}</button>`).join('')}
        </div>
      </div>
      <div id="ses-fb" style="display:none"></div>
      <div id="ses-sig" style="display:none;margin-top:1rem"><button type="button" class="atril-open" onclick="sesionSiguienteItem()">Seguir</button></div>`;
    return;
  }
  body.innerHTML = `${cuenta}
    <div class="srs-contexto">${esc(t.libro_titulo || '')} · <em>${esc(t.libro_autor || '')}</em></div>
    <div class="preg-card">
      <div class="ses-sub" style="margin-top:0">${esc(t.leccion_titulo || '')}</div>
      <div class="fmt">${fmt(t.aplicacion_practica || '')}</div>
    </div>
    <p class="ses-sub">¿Tienes ya tu posición sobre esto?</p>
    <div class="ses-opciones">
      <button type="button" class="ses-chip" onclick="sesionTarjetaReflexion('pendiente')">Aún no</button>
      <button type="button" class="ses-chip" onclick="sesionTarjetaReflexion('en_proceso')">En ello</button>
      <button type="button" class="ses-chip" onclick="sesionTarjetaReflexion('integrado')">Sí</button>
    </div>`;
}

function sesionSiguienteItem() { ses.ri++; sesionRender(); }

function sesionContarRepaso(extra) {
  revisiones.push(new Date().toISOString());
  marcarDiaEstudiado();
  ses.resumen.recordadas++;
  track('tarjeta', Object.assign({ origen: 'sesion' }, extra || {}));
}

async function sesionTarjetaQuiz(idx) {
  const t = ses.items[ses.ri].t;
  const btns = document.querySelectorAll('#ses-opts .opt-btn');
  btns.forEach(b => b.disabled = true);
  const ok = idx === t.correcta;
  btns[idx].classList.add(ok ? 'ok' : 'err');
  if (!ok && btns[t.correcta]) btns[t.correcta].classList.add('ok');
  const fb = document.getElementById('ses-fb');
  fb.style.display = 'block';
  fb.className = `feedback ${ok ? 'ok' : 'err'}`;
  fb.innerHTML = `<div class="feedback-head">${ok ? 'Correcto' : 'No era esa'}</div>${esc(t.explicacion || '')}`;
  document.getElementById('ses-sig').style.display = 'block';
  sesionContarRepaso({ modo: 'quiz', ok });
  try { await srsRPC('registrar_repaso', { p_repaso_id: t.repaso_id, p_evaluacion: ok ? 'correcto' : 'fallo' }); } catch (e) {}
}

async function sesionTarjetaReflexion(ev) {
  const t = ses.items[ses.ri].t;
  document.querySelectorAll('.ses-chip').forEach(b => b.disabled = true);
  sesionContarRepaso({ modo: 'reflexion', ev });
  try { await srsRPC('registrar_repaso', { p_repaso_id: t.repaso_id, p_evaluacion: ev }); } catch (e) {}
  sesionSiguienteItem();
}

async function sesionCompromiso(res) {
  const c = ses.items[ses.ri].c;
  document.querySelectorAll('.ses-chip').forEach(b => b.disabled = true);
  revisiones.push(new Date().toISOString());
  marcarDiaEstudiado();
  track('compromiso_respondido', { resultado: res });
  sesPrecarga.compromiso = null;
  try {
    await sb(`compromisos?id=eq.${c.id}`, { method: 'PATCH', body: JSON.stringify({ resultado: res, respondido_at: new Date().toISOString() }) });
  } catch (e) {}
  sesionSiguienteItem();
}

/* ── Paso 2 · Lee ── */
function sesionLee(body) {
  const lec = ses.lec;
  const libro = libros.find(l => l.id === lec.libro_id);
  const modo = sesModoLectura();
  const min = ses.minCompleta || Didactica.minutosLectura(lec);
  const mc = Sesion.minutosCorta(min);
  const idea = (lec.idea_clave || '').trim();
  let cuerpo;
  if (modo === 'corta') {
    const resumen = cuadPlain(lec.cuerpo, idea ? 520 : 700);
    cuerpo = `${idea ? `<p class="ses-idea">${esc(idea)}</p>` : ''}
      ${resumen ? `<p class="ses-texto">${esc(resumen)}</p>` : ''}
      ${lec.autocorreccion ? `<div class="auto-box"><div class="auto-label">El giro</div><div class="fmt">${fmt(lec.autocorreccion)}</div></div>` : ''}`;
  } else {
    cuerpo = `${idea ? `<p class="ses-idea">${esc(idea)}</p>` : ''}
      <div class="lec-body fmt">${fmt(lec.cuerpo)}</div>
      ${lec.conexion_cruzada ? `<div class="con-box"><div class="con-label">Cruce</div><div class="fmt">${fmt(lec.conexion_cruzada)}</div></div>` : ''}
      ${lec.autocorreccion ? `<div class="auto-box"><div class="auto-label">El giro</div><div class="fmt">${fmt(lec.autocorreccion)}</div></div>` : ''}`;
  }
  body.innerHTML = `<p class="ses-kicker">Lee · ${modo === 'corta' ? mc : min} min</p>
    <h2 class="ses-title">${esc(lec.titulo)}</h2>
    <p class="ses-meta">${libro ? `<em>${esc(libro.titulo)}</em> — ${esc(libro.autor)}` : ''}${lec.orden ? ' · Lección ' + lec.orden : ''}</p>
    <div class="ses-modo">
      <button type="button" class="ses-chip ${modo === 'corta' ? 'on' : ''}" onclick="sesionModo('corta')">2 min</button>
      <button type="button" class="ses-chip ${modo === 'completa' ? 'on' : ''}" onclick="sesionModo('completa')">Completa · ${min} min</button>
    </div>
    <div class="ses-lectura">${cuerpo}</div>
    <div class="ses-pie"><button type="button" class="atril-open" onclick="sesionSiguientePaso()">Seguir</button></div>`;
}

function sesionModo(m) {
  LS.set(SES_MODO_K, m);
  sesionRender();
}

/* ── Paso 3 · Comprueba ── */
function sesionComprueba(body) {
  const q = ses.pregunta;
  body.innerHTML = `<p class="ses-kicker">Comprueba</p>
    <div class="preg-card">
      <div class="preg-txt">${esc(q.texto)}</div>
      <div class="opts-grid" id="ses-opts">
        ${(q.opciones || []).map((o, i) => `<button type="button" class="opt-btn" onclick="sesionRespondeComprueba(${i})"><span class="opt-letter">${['A', 'B', 'C', 'D'][i] || ''}</span>${esc(o)}</button>`).join('')}
      </div>
    </div>
    <div id="ses-fb" style="display:none"></div>
    <div id="ses-sig" style="display:none;margin-top:1rem"><button type="button" class="atril-open" onclick="sesionSiguientePaso()">Seguir</button></div>`;
}

function sesionRespondeComprueba(idx) {
  const q = ses.pregunta;
  const btns = document.querySelectorAll('#ses-opts .opt-btn');
  btns.forEach(b => b.disabled = true);
  const ok = idx === q.correcta;
  btns[idx].classList.add(ok ? 'ok' : 'err');
  if (!ok && btns[q.correcta]) btns[q.correcta].classList.add('ok');
  const fb = document.getElementById('ses-fb');
  fb.style.display = 'block';
  fb.className = `feedback ${ok ? 'ok' : 'err'}`;
  fb.innerHTML = `<div class="feedback-head">${ok ? 'Correcto' : 'No era esa'}</div>${esc(q.explicacion || '')}`;
  document.getElementById('ses-sig').style.display = 'block';
  track('comprobacion', { ok });
}

/* ── Paso 4 · Lleva ── */
function sesionLleva(body) {
  const lec = ses.lec;
  const txt = Sesion.textoAccion(lec.aplicacion_practica);
  const sel = o => (ses.acc === o ? ' on' : '');
  body.innerHTML = `<p class="ses-kicker">Lleva</p>
    <h2 class="ses-title">Qué haces con esto</h2>
    <blockquote class="ses-cita">${esc(txt)}</blockquote>
    <p class="ses-sub">¿Cuándo?</p>
    <div class="ses-opciones">
      <button type="button" class="ses-chip${sel('hoy')}" onclick="sesionAccion('hoy')">Hoy</button>
      <button type="button" class="ses-chip${sel('semana')}" onclick="sesionAccion('semana')">Esta semana</button>
      <button type="button" class="ses-chip${sel('no')}" onclick="sesionAccion('no')">No aplica</button>
    </div>
    <label class="ses-sub" for="ses-nota">Al margen <small>(opcional)</small></label>
    <textarea class="notas-area" id="ses-nota" placeholder="Una frase. No un resumen." oninput="ses.nota=this.value">${esc(ses.nota)}</textarea>
    <div class="ses-pie"><button type="button" class="atril-open" onclick="sesionCerrar()">Cerrar por hoy</button></div>`;
}

function sesionAccion(o) {
  ses.acc = o;
  document.querySelectorAll('.ses-opciones .ses-chip').forEach(b => b.classList.remove('on'));
  const idx = { hoy: 0, semana: 1, no: 2 }[o];
  document.querySelectorAll('.ses-opciones .ses-chip')[idx]?.classList.add('on');
}

/* ── Cierre ── */
async function sesionCerrar() {
  if (ses.cerrando) return;
  ses.cerrando = true;
  const lec = ses.lec;
  const btn = document.querySelector('.ses-pie .atril-open');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
  try {
    if (lec) {
      const nota = (ses.nota || '').trim();
      if (nota) {
        const previa = getNotas(lec.id);
        await saveNota(lec.id, previa ? previa + '\n' + nota : nota).catch(() => {});
      }
      const nxt = siguienteLeccionMismoLibro(lec.id);
      guardarHilo(lec, nxt);
      await marcarCompletada(lec.id, { sinNavegar: true });
      ses.resumen.leida = true;
      if (ses.acc === 'hoy' || ses.acc === 'semana') {
        ses.resumen.accion = true;
        sb('compromisos', { method: 'POST', body: JSON.stringify({
          usuario_id: SRS_USER, leccion_id: lec.id, texto: Sesion.textoAccion(lec.aplicacion_practica),
          para: Sesion.diaCompromiso(ses.acc, Dia.hoy())
        }) }).catch(() => {});
      }
    }
  } catch (e) { toast('No se pudo guardar: ' + (e.message || e)); ses.cerrando = false; return; }
  sesionFin();
}

function sesionFin() {
  const root = document.getElementById('sesion-root');
  if (!root || !ses) return;
  ses.cerrada = true;
  const segundos = Math.round((Date.now() - ses.t0) / 1000);
  const texto = Sesion.resumen(ses.resumen);
  track('sesion_cerrada', Object.assign({ segundos, solo: ses.solo }, ses.resumen));
  if (!ses.solo) LS.set(SES_HOY_K, { dia: Dia.hoy(), texto, lecId: ses.lec ? ses.lec.id : null });
  sesPrecarga = { tarjetas: [], compromiso: null, listo: false };
  const lec = ses.lec;
  const nxt = lec ? siguienteLeccionMismoLibro(lec.id) : null;
  const mes = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][+Dia.hoy().slice(5, 7) - 1];

  if (ses.solo) {
    root.innerHTML = `<div class="ses-fin">
      <p class="ses-kicker">Recordar · hecho</p>
      <h2 class="ses-title">Hoy cuenta.</h2>
      <p class="ses-meta">${esc(texto) || 'Sin tarjetas por hoy.'}</p>
      <div class="ses-cierre-acciones">
        <button type="button" class="atril-open" onclick="sesionLeerAhora()">Leer la lección de hoy</button>
        <button type="button" class="atril-ghost" onclick="sesionSalir()">Volver</button>
      </div></div>`;
    return;
  }
  const hilo = getHilo();
  root.innerHTML = `<div class="ses-fin">
    <p class="ses-kicker">La lámpara sigue encendida</p>
    <h2 class="atril-title closed">Hasta mañana.</h2>
    <p class="ses-meta">${esc(texto) || 'Sesión de hoy completa.'}</p>
    <div class="atril-nights ses-noches">${lampsHtml(estadoSemana().n)}<span>${esc(estadoSemana().texto)}</span></div>
    ${hilo && hilo.frase ? `<p class="ses-sub">Mañana abre aquí</p><p class="atril-tomorrow"><em>${esc(hilo.frase)}</em></p>` : ''}
    <div class="atril-stamp">Ex libris · ${Dia.hoy().slice(8)} ${mes}</div>
    <div class="ses-cierre-acciones">
      <button type="button" class="atril-open" onclick="sesionSalir()">Hasta mañana</button>
      ${nxt ? `<button type="button" class="atril-ghost" onclick="sesionOtra()">Otra de este tomo</button>` : ''}
      <button type="button" class="atril-ghost" onclick="sesionMasTarjetas()">Más tarjetas</button>
    </div></div>`;
  sesPrecargar();
}

function sesionLeerAhora() {
  ses = null;
  sesPrecarga = { tarjetas: [], compromiso: null, listo: true };
  sesionEmpezar(false);
}
function sesionOtra() {
  const l = ses && ses.lec ? siguienteLeccionMismoLibro(ses.lec.id) : null;
  ses = null;
  if (l) abrirCuaderno(l.id); else showView('home');
}
function sesionMasTarjetas() {
  ses = null;
  cincoTarjetasNoche();
}

// Los eventos pendientes se envían al ocultar la app (cierre, cambio de pestaña).
document.addEventListener('visibilitychange', () => { if (document.hidden) flushEventos(); });
