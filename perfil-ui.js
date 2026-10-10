/* ═══════════════════════════════════════════
   PERFIL — onboarding de 3 preguntas, ruta activa, constancia semanal,
   «Tú» (resumen de la semana y mapa de dominios).
   Usa los globales de app.js. Lógica pura: lib/perfil.js, lib/dia.js, lib/didactica.js
   Diseño: docs/rediseno-uso-diario.md §5, §7, §8
═══════════════════════════════════════════ */
const PERFIL_K = 'scs2_perfil';
const DIAS_LBL = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const getPerfil = () => LS.get(PERFIL_K, null);
const perfilActivo = () => { const p = getPerfil(); return Perfil.completo(p) ? p : null; };

/* ── Ruta activa ── */
function rutaActivaItems() {
  const p = perfilActivo();
  if (!p || !p.ruta) return null;
  return Didactica.rutasDisponibles(libros, lecs, completadasSet()).find(r => r.id === p.ruta) || null;
}
function rutaSiguienteLeccion() {
  const r = rutaActivaItems();
  if (!r) return null;
  const comp = completadasSet();
  for (const it of r.items) {
    const l = Didactica.siguienteLeccion(it.libro, lecs, comp);
    if (l) return l;
  }
  return null;
}
/** ¿Esta lección pertenece a un tomo de la ruta activa (o no hay ruta)? */
function lecEnRuta(lec) {
  const r = rutaActivaItems();
  if (!r) return true;
  return !!lec && r.items.some(i => i.libro.id === lec.libro_id);
}
function hiloValido(hilo) {
  if (!hilo) return false;
  return lecEnRuta(lecs.find(l => l.id === hilo.nextId));
}

/* ── Constancia semanal ── */
function estadoSemana() {
  const f = fechasActividad();
  if (isNocheCerrada()) f.push(new Date().toISOString());
  const n = Dia.semana(f).size;
  const p = perfilActivo();
  const meta = p ? p.dias : null;
  return {
    n, meta, cumplida: meta ? n >= meta : false,
    texto: meta ? `${n} de ${meta} esta semana` : `${n} ${n === 1 ? 'día' : 'días'} esta semana`
  };
}

/* ── Tarjeta en Hoy ── */
function perfilCardHtml() {
  if (getPerfil()) return '';
  return `<div class="perfil-card">
    <p class="ses-card-k">Tu ruta</p>
    <p class="perfil-card-t">Tres preguntas y la sesión de cada día sigue una ruta pensada para ti.</p>
    <div class="atril-actions">
      <button type="button" class="atril-open" onclick="perfilEmpezar()">Elegir mi ruta</button>
      <button type="button" class="atril-ghost" onclick="perfilAhoraNo()">Ahora no</button>
    </div>
  </div>`;
}
function perfilAhoraNo() {
  LS.set(PERFIL_K, { omitido: true, ts: new Date().toISOString() });
  if (typeof track === 'function') track('onboarding_omitido');
  renderAtril();
}

/* ── Onboarding ── */
let ob = null;

function perfilEmpezar() {
  const p = perfilActivo();
  ob = { paso: 0, objetivo: p ? p.objetivo : null, minutos: p ? p.minutos : null, dias: p ? p.dias : null };
  if (typeof track === 'function') track('onboarding_inicio');
  showView('onboarding');
  obRender();
}

function obSalir() { ob = null; showView('home'); }

function obRender() {
  const root = document.getElementById('onboarding-root');
  if (!root || !ob) return;
  const barra = `<div class="ses-bar">
    <button type="button" class="back-btn" onclick="obSalir()">Salir</button>
    <div class="ses-seg">${[0, 1, 2].map(i => `<i class="${i < ob.paso ? 'hecho' : i === ob.paso ? 'on' : ''}"></i>`).join('')}</div>
    <span class="ses-cuenta">${Math.min(ob.paso + 1, 3)}/3</span>
  </div>`;
  let cuerpo = '';
  if (ob.paso === 0) {
    cuerpo = `<p class="ses-kicker">Tu ruta</p><h2 class="ses-title">¿Qué quieres entrenar?</h2>
      <div class="ob-lista">${Perfil.OBJETIVOS.map(o => `<button type="button" class="ob-op${ob.objetivo === o.id ? ' on' : ''}" onclick="obElegir('objetivo','${o.id}')">${esc(o.etiqueta)}</button>`).join('')}</div>`;
  } else if (ob.paso === 1) {
    cuerpo = `<p class="ses-kicker">Tu ruta</p><h2 class="ses-title">¿Cuánto tiempo al día?</h2>
      <div class="ob-lista">${Perfil.TIEMPOS.map(t => `<button type="button" class="ob-op${ob.minutos === t.min ? ' on' : ''}" onclick="obElegir('minutos',${t.min})">${esc(t.etiqueta)}<small>${esc(t.sub)}</small></button>`).join('')}</div>`;
  } else if (ob.paso === 2) {
    cuerpo = `<p class="ses-kicker">Tu ruta</p><h2 class="ses-title">¿Cuántos días a la semana?</h2>
      <p class="ses-meta">Es un objetivo, no una obligación: perder un día no borra nada.</p>
      <div class="ob-lista">${Perfil.DIAS.map(d => `<button type="button" class="ob-op${ob.dias === d.dias ? ' on' : ''}" onclick="obElegir('dias',${d.dias})">${esc(d.etiqueta)}<small>${esc(d.sub)}</small></button>`).join('')}</div>`;
  } else {
    const disp = Didactica.rutasDisponibles(libros, lecs, completadasSet());
    const p = Perfil.crear(ob, disp.map(r => r.id));
    const ruta = disp.find(r => r.id === p.ruta);
    const modo = p.modo === 'completa' ? 'lectura completa' : 'lectura de 2 minutos';
    cuerpo = `<p class="ses-kicker">Tu ruta</p>
      <h2 class="ses-title">${ruta ? esc(ruta.titulo) : 'Sin ruta fija'}</h2>
      <p class="ses-meta">${ruta
        ? `${ruta.items.length} tomos · ${ruta.total} lecciones. ${esc(ruta.sub)}`
        : 'La sesión de cada día seguirá donde lo dejaste.'}</p>
      <ul class="ob-resumen">
        <li><b>${p.minutos} min</b> al día · ${modo}</li>
        <li><b>${p.dias === 7 ? 'Todos los días' : p.dias + ' días'}</b> por semana como objetivo</li>
      </ul>
      <div class="ses-pie"><button type="button" class="atril-open" onclick="obGuardar()">Empezar</button>
        <button type="button" class="atril-ghost" onclick="ob.paso=0;obRender()">Cambiar</button></div>`;
  }
  root.innerHTML = barra + `<div class="ses-body">${cuerpo}</div>`;
  window.scrollTo(0, 0);
}

function obElegir(k, v) {
  ob[k] = v;
  ob.paso++;
  obRender();
}

function obGuardar() {
  const disp = Didactica.rutasDisponibles(libros, lecs, completadasSet()).map(r => r.id);
  const p = Perfil.crear(Object.assign({}, ob, { ts: new Date().toISOString() }), disp);
  LS.set(PERFIL_K, p);
  LS.set(SES_MODO_K, p.modo);
  if (typeof track === 'function') track('onboarding', { objetivo: p.objetivo, minutos: p.minutos, dias: p.dias, ruta: p.ruta });
  ob = null;
  showView('home');
  toast('Ruta guardada');
}

/* ── Tú: constancia, resumen semanal, dominios ── */
let tuAsentadas = new Set();

function tuSemanaHtml() {
  const ini = Dia.inicioSemana(Dia.hoy());
  const f = fechasActividad();
  if (isNocheCerrada()) f.push(new Date().toISOString());
  const activos = Dia.semana(f);
  const puntos = DIAS_LBL.map((l, i) => {
    const d = new Date(ini + 'T12:00:00'); d.setDate(d.getDate() + i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `<span class="tu-dia${activos.has(k) ? ' on' : ''}${k === Dia.hoy() ? ' hoy' : ''}"><i></i>${l}</span>`;
  }).join('');
  const sem = estadoSemana();
  const p = perfilActivo();
  const seguidas = p ? Dia.semanasCumplidas(f, p.dias) : 0;
  return `<div class="tu-semana">${puntos}</div>
    <p class="tu-linea"><b>${esc(sem.texto)}</b>${p && seguidas ? ` · ${seguidas} semana${seguidas === 1 ? '' : 's'} seguida${seguidas === 1 ? '' : 's'} con tu objetivo` : ''}</p>`;
}

function tuResumenHtml() {
  const ini = Dia.inicioSemana(Dia.hoy());
  const enSemana = f => f && Dia.inicioSemana(Dia.logico(f)) === ini;
  const leidas = new Set(prog.filter(p => p.tipo === 'leccion' && enSemana(p.fecha)).map(p => p.item_id)).size;
  const tarjetas = revisiones.filter(enSemana).length;
  return `<div class="srs-stats-grid">
    <div class="srs-stat"><div class="srs-stat-num">${leidas}</div><div class="srs-stat-lbl">Lecciones</div></div>
    <div class="srs-stat"><div class="srs-stat-num">${tarjetas}</div><div class="srs-stat-lbl">Tarjetas</div></div>
    <div class="srs-stat"><div class="srs-stat-num" id="tu-acciones">–</div><div class="srs-stat-lbl">Acciones</div></div>
  </div>`;
}

function tuDominiosHtml() {
  const d = Didactica.dominios(libros, lecs, completadasSet(), tuAsentadas);
  if (!d.length) return '';
  return d.map(e => `<details class="dom-eje">
    <summary>
      <span class="dom-nombre">${esc(e.eje)}</span>
      <span class="dom-cifra">${e.hechas}/${e.total}${e.asentadas ? ` · ${e.asentadas} asentada${e.asentadas === 1 ? '' : 's'}` : ''}</span>
      <span class="dom-barra"><i style="width:${e.pct}%"></i></span>
    </summary>
    ${e.subs.map(s => `<div class="dom-sub">
      <span class="dom-nombre">${esc(s.sub)}</span>
      <span class="dom-cifra">${s.hechas}/${s.total}</span>
      <span class="dom-barra"><i style="width:${s.pct}%"></i></span>
    </div>`).join('')}
  </details>`).join('');
}

function renderTu() {
  const root = document.getElementById('tu-cont');
  if (!root) return;
  const p = perfilActivo();
  const ruta = rutaActivaItems();
  const fila = (t, sub, fn) => `<button type="button" class="tu-row" onclick="${fn}"><span class="tu-row-t">${t}</span><span class="tu-row-s">${sub}</span></button>`;
  root.innerHTML = `
    <p class="sec-label">Esta semana</p>
    ${tuSemanaHtml()}
    ${tuResumenHtml()}
    <p class="tu-nota">Cuenta leer y repasar. El día acaba a las 04:00.</p>
    <p class="sec-label" style="margin-top:2rem">Mapa de dominios</p>
    <p class="tu-nota" style="margin-top:0">Lecciones leídas por eje; «asentadas» son las que ya recuerdas con firmeza.</p>
    <div id="tu-dominios" class="dom-lista">${tuDominiosHtml()}</div>
    <div class="tu-list" style="margin-top:2rem">
      ${fila('Tu ruta', p ? (ruta ? esc(ruta.titulo) + ` · ${ruta.pct}%` : 'Sin ruta fija') + ` · ${p.minutos} min · ${p.dias === 7 ? 'cada día' : p.dias + ' días'}` : 'Elige objetivo, tiempo y días', 'perfilEmpezar()')}
      ${fila('Guardados', `${favLecs().length} lecciones · ${favLibros().length} libros`, "showView('favoritos')")}
      ${fila('Avisos', 'Recordatorio diario y ajustes', 'toggleNotifPanel()')}
      ${fila('Mapa de conexiones', 'Autores y tesis cruzadas', "location.href='mapa.html'")}
    </div>`;
  tuCargarAsentadas();
  tuCargarAcciones();
}

/* Lecciones con su reflexión en nivel firme (≥4: 16 días o más). Si falla, solo se omite. */
async function tuCargarAsentadas() {
  try {
    const r = await sbAll(`repaso?select=leccion_id&modo=eq.reflexion&estado=eq.activa&nivel=gte.4&usuario_id=eq.${SRS_USER}`);
    tuAsentadas = new Set((r || []).map(x => x.leccion_id).filter(Boolean));
    const el = document.getElementById('tu-dominios');
    if (el) el.innerHTML = tuDominiosHtml();
  } catch (e) {}
}

async function tuCargarAcciones() {
  try {
    const ini = Dia.inicioSemana(Dia.hoy());
    const r = await sb(`compromisos?select=id&usuario_id=eq.${SRS_USER}&created_at=gte.${ini}T00:00:00`);
    const el = document.getElementById('tu-acciones');
    if (el) el.textContent = String((r || []).length);
  } catch (e) {}
}
