/* ═══════════════════════════════════════════
   MAZO — entrada rápida (cinco fichas finitas) y reanudación de la lectura.
   Usa los globales de app.js (libros, lecs, esc, LS, track, completadasSet, pickNocheLeccion,
   abrirFolioAtril, verLeccion, toast). Lógica pura y tests: lib/mazo.js
   Diseño: docs/rediseno-uso-diario.md §16
═══════════════════════════════════════════ */
const LECTURA_K = 'scs2_lectura';          // { lecId, y (fracción leída), ts, activa }
const MAZO_VISTAS_K = 'scs2_mazo_vistas';
let mazoFichas = null, mazoSemilla = Date.now(), mazoCerrado = false;

/* ── Lectura en curso: se guarda mientras lees y se recupera al volver ── */
const getLectura = () => LS.get(LECTURA_K, null);
function lecturaInicio(lecId) {
  const prev = getLectura();
  const y = prev && prev.lecId === lecId ? prev.y || 0 : 0;
  LS.set(LECTURA_K, { lecId, y, ts: Date.now(), activa: true });
}
function lecturaGuardarPosicion() {
  const v = document.getElementById('view-leccion');
  if (!v || !v.classList.contains('active') || !lecActual) return;
  const alto = document.documentElement.scrollHeight - window.innerHeight;
  const y = alto > 0 ? Math.min(1, Math.max(0, window.scrollY / alto)) : 0;
  LS.set(LECTURA_K, { lecId: lecActual.id, y, ts: Date.now(), activa: true });
}
function lecturaPausar() {                 // saliste de la lección dentro de la app
  const l = getLectura();
  if (l && l.activa) LS.set(LECTURA_K, Object.assign({}, l, { activa: false }));
}
function lecturaTerminada(lecId) {
  const l = getLectura();
  if (l && l.lecId === lecId) { try { localStorage.removeItem(LECTURA_K); } catch (e) {} }
}
let lecturaT = null;
window.addEventListener('scroll', () => {
  if (lecturaT) return;
  lecturaT = setTimeout(() => { lecturaT = null; lecturaGuardarPosicion(); }, 800);
}, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) lecturaGuardarPosicion(); });

/** Al abrir la app: si estabas leyendo hace poco, vuelve exactamente ahí. */
function reanudarAlAbrir() {
  const h = window.location.hash.slice(1);
  if (h && h !== 'home') return false;     // un enlace concreto manda
  const l = getLectura();
  if (Mazo.decidirReanudar(l, Date.now(), completadasSet()) !== 'abrir') return false;
  const lec = lecs.find(x => x.id === l.lecId);
  if (!lec) return false;
  libroActual = libros.find(b => b.id === lec.libro_id) || null;
  verLeccion(lec.id);
  const y = l.y || 0;
  setTimeout(() => {
    const alto = document.documentElement.scrollHeight - window.innerHeight;
    if (alto > 0 && y > 0.02) window.scrollTo(0, Math.round(y * alto));
    if (typeof toast === 'function') toast('Seguías aquí');
  }, 80);
  if (typeof track === 'function') track('lectura_reanudada', { y: Math.round(y * 100) });
  return true;
}

/* ── Mazo ── */
function mazoComponer() {
  const comp = completadasSet();
  const l = getLectura();
  let reanudar = null;
  if (Mazo.decidirReanudar(l, Date.now(), comp)) {
    const lec = lecs.find(x => x.id === l.lecId);
    if (lec) reanudar = { lec, restante: Mazo.minutosRestantes(Didactica.minutosLectura(lec), l.y) };
  }
  return Mazo.componer({
    lecs, completadas: comp, reanudar,
    siguiente: typeof pickNocheLeccion === 'function' ? pickNocheLeccion() : null,
    vistas: LS.get(MAZO_VISTAS_K, []), semilla: mazoSemilla
  });
}
const mazoLibro = lec => libros.find(b => b.id === lec.libro_id) || null;
const mazoFuente = lec => { const b = mazoLibro(lec); return b ? `<em>${esc(b.titulo)}</em> · ${esc(b.autor || '')}` : ''; };

function mazoFichaHtml(f, i, n) {
  const lec = f.lecId ? lecs.find(x => x.id === f.lecId) : null;
  const pie = `<div class="mz-n">${i + 1} / ${n}</div>`;
  const leer = lec ? `<button type="button" class="mz-btn" onclick="mazoLeer('${lec.id}','${f.tipo}')">Leer · ${Didactica.minutosLectura(lec)} min</button>` : '';
  if (f.tipo === 'reanudar' && lec) return `<article class="mz-card mz-reanudar">
      <p class="mz-k">Seguías aquí${f.restante ? ` · quedan ${f.restante} min` : ''}</p>
      <h3 class="mz-t">${esc(lec.titulo)}</h3><p class="mz-src">${mazoFuente(lec)}</p>
      <div class="mz-acc"><button type="button" class="mz-btn" onclick="mazoLeer('${lec.id}','reanudar')">Seguir leyendo</button></div>${pie}</article>`;
  if (f.tipo === 'recuerda' && lec) return `<article class="mz-card mz-recuerda" id="mz-${i}">
      <p class="mz-k">¿Lo recuerdas?</p>
      <h3 class="mz-t">${esc(lec.titulo)}</h3><p class="mz-src">${mazoFuente(lec)}</p>
      <p class="mz-q">Piensa un momento cuál era la idea antes de verla.</p>
      <div class="mz-oculto"><p class="mz-txt">${esc(Mazo.extracto(lec.idea_clave, 320))}</p>
        <div class="mz-acc"><button type="button" class="mz-btn ghost" onclick="mazoRecuerdo(${i},true)">La tenía</button>
        <button type="button" class="mz-btn ghost" onclick="mazoRecuerdo(${i},false)">No del todo</button></div></div>
      <div class="mz-acc mz-ver"><button type="button" class="mz-btn" onclick="mazoVer(${i})">Ver la idea</button></div>${pie}</article>`;
  if (f.tipo === 'idea' && lec) {
    const fig = (typeof Diagrama !== 'undefined' ? Diagrama.deLeccion(lec) : []).slice(0, 1).map(Diagrama.render).join('');
    const amp = [lec.autocorreccion && `<p class="mz-amp-k">El matiz</p><p class="mz-txt">${esc(Mazo.extracto(lec.autocorreccion, 360))}</p>`,
                 lec.aplicacion_practica && `<p class="mz-amp-k">Para aplicarlo</p><p class="mz-txt">${esc(Mazo.extracto(lec.aplicacion_practica, 280))}</p>`].filter(Boolean).join('');
    return `<article class="mz-card mz-idea" id="mz-${i}">
      <p class="mz-k">${f.siguiente ? 'Lo que toca leer' : 'Una idea'}</p>
      ${fig ? `<div class="mz-fig">${fig}</div>` : ''}
      <h3 class="mz-t">${esc(lec.titulo)}</h3><p class="mz-src">${mazoFuente(lec)}</p>
      <p class="mz-txt">${esc(Mazo.extracto(lec.idea_clave, fig ? 220 : 380))}</p>
      ${amp ? `<div class="mz-amp">${amp}</div>` : ''}
      <div class="mz-acc">${amp ? `<button type="button" class="mz-btn ghost mz-ampliar" onclick="mazoAmpliar(${i})">Ampliar</button>` : ''}${leer}</div>${pie}</article>`;
  }
  if (f.tipo === 'matiz' && lec) return `<article class="mz-card mz-matiz">
      <p class="mz-k">El matiz</p><h3 class="mz-t">${esc(lec.titulo)}</h3><p class="mz-src">${mazoFuente(lec)}</p>
      <p class="mz-txt">${esc(Mazo.extracto(lec.autocorreccion, 420))}</p>
      <div class="mz-acc">${leer}</div>${pie}</article>`;
  if (f.tipo === 'cita' && lec) return `<article class="mz-card mz-cita">
      <p class="mz-k">Una idea</p><blockquote class="mz-quote">${esc(Mazo.extracto(lec.cita_memorable, 300))}</blockquote>
      <p class="mz-src">${mazoFuente(lec)}</p><div class="mz-acc">${leer}</div>${pie}</article>`;
  // Cierre: una sola oferta de subir, sin presión
  const min = lec ? Didactica.minutosLectura(lec) : 0;
  return `<article class="mz-card mz-cierre">
      <p class="mz-k">Has terminado por ahora</p>
      ${lec ? `<h3 class="mz-t">¿Tienes ${min} minutos?</h3><p class="mz-txt">${esc(lec.titulo)} — ${mazoFuente(lec)}</p>
      <div class="mz-acc"><button type="button" class="mz-btn" onclick="mazoLeer('${lec.id}','cierre')">Leer ahora</button>
      <button type="button" class="mz-btn ghost" onclick="mazoCerrar()">Hasta luego</button></div>`
      : `<div class="mz-acc"><button type="button" class="mz-btn ghost" onclick="mazoCerrar()">Hasta luego</button></div>`}${pie}</article>`;
}

function renderMazo() {
  const root = document.getElementById('mazo');
  if (!root || typeof Mazo === 'undefined' || !lecs.length) return;
  if (mazoCerrado) {
    root.dataset.semilla = '';
    root.innerHTML = `<div class="mz-hecho">Mazo visto. <button type="button" class="mz-link" onclick="mazoOtro()">Otro mazo</button></div>`;
    return;
  }
  if (mazoFichas && root.dataset.semilla === String(mazoSemilla) && root.querySelector('.mz-track')) return;   // no mover lo que ya estás mirando
  if (!mazoFichas) mazoFichas = mazoComponer();
  root.dataset.semilla = String(mazoSemilla);
  const n = mazoFichas.length;
  root.innerHTML = `<div class="mz-track" id="mz-track">${mazoFichas.map((f, i) => mazoFichaHtml(f, i, n)).join('')}</div>
    <div class="mz-dots" aria-hidden="true">${mazoFichas.map((_, i) => `<span${i ? '' : ' class="on"'}></span>`).join('')}</div>`;
  const pista = document.getElementById('mz-track');
  const dots = root.querySelectorAll('.mz-dots span');
  const vistas = new Set();
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(ents => ents.forEach(e => {
    if (!e.isIntersecting) return;
    const i = [...pista.children].indexOf(e.target);
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    if (vistas.has(i)) return;
    vistas.add(i);
    const f = mazoFichas[i];
    if (f && f.lecId && f.tipo !== 'cierre') LS.set(MAZO_VISTAS_K, LS.get(MAZO_VISTAS_K, []).concat(f.lecId).slice(-40));
    if (typeof track === 'function') track('ficha', { tipo: f.tipo, i, accion: 'vista' });
  }), { root: pista, threshold: 0.6 }) : null;
  if (io) [...pista.children].forEach(c => io.observe(c));
}

function mazoLeer(id, tipo) {
  if (typeof track === 'function') track('ficha', { tipo, accion: 'leer', peldano: 2 });
  abrirFolioAtril(id);
}
function mazoAmpliar(i) {
  const c = document.getElementById('mz-' + i);
  if (!c) return;
  c.classList.toggle('abierta');
  const b = c.querySelector('.mz-ampliar');
  if (b) b.textContent = c.classList.contains('abierta') ? 'Menos' : 'Ampliar';
  if (c.classList.contains('abierta') && typeof track === 'function') track('ficha', { tipo: 'idea', accion: 'ampliar', peldano: 1 });
}
function mazoVer(i) {
  const c = document.getElementById('mz-' + i);
  if (c) c.classList.add('vista');
}
function mazoRecuerdo(i, ok) {
  if (typeof track === 'function') track('ficha', { tipo: 'recuerda', accion: ok ? 'la_tenia' : 'no_del_todo' });
  const c = document.getElementById('mz-' + i);
  if (c) { const a = c.querySelector('.mz-oculto .mz-acc'); if (a) a.innerHTML = `<span class="mz-ok">${ok ? 'Bien.' : 'Ahora ya está más cerca.'}</span>`; }
  const t = document.getElementById('mz-track');
  if (t && c && c.nextElementSibling) setTimeout(() => t.scrollTo({ left: c.nextElementSibling.offsetLeft - t.offsetLeft, behavior: 'smooth' }), 500);
}
function mazoCerrar() {
  if (typeof track === 'function') track('ficha', { tipo: 'cierre', accion: 'hasta_luego' });
  mazoCerrado = true; renderMazo();
}
function mazoOtro() {
  mazoCerrado = false; mazoSemilla = Date.now(); mazoFichas = null; renderMazo();
}
