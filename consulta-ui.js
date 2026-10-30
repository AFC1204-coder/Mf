/* Modo «Consulta»: el usuario cuenta una necesidad o duda y la app propone los libros que mejor la abordan.
   El motor es lib/consulta.js (recuperación de texto sobre el corpus local, sin IA ni red). */

const CONSULTA_HIST_K = 'consulta_hist';
let consultaIx = null, consultaIxClave = '';
const consultaEstado = { texto: '', eje: '', verMas: false };

function consultaIndice() {
  const clave = `${libros.length}:${lecs.length}`;
  if (!consultaIx || consultaIxClave !== clave) { consultaIx = Consulta.construirIndice(libros, lecs); consultaIxClave = clave; }
  return consultaIx;
}

/** Algunas necesidades de ejemplo, distintas en cada apertura. */
function consultaEjemplos() {
  const todos = [...Consulta.EJEMPLOS];
  for (let i = todos.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [todos[i], todos[j]] = [todos[j], todos[i]]; }
  return todos.slice(0, 6);
}

function consultaHistorial() {
  const h = LS.get(CONSULTA_HIST_K, []);
  return Array.isArray(h) ? h.filter(x => typeof x === 'string').slice(0, 5) : [];
}
function consultaGuardarHistorial(texto) {
  const t = texto.trim();
  if (t.length < 3) return;
  const h = [t, ...consultaHistorial().filter(x => x !== t)].slice(0, 5);
  LS.set(CONSULTA_HIST_K, h);
}

function renderConsulta() {
  const root = document.getElementById('consulta-root');
  if (!root) return;
  const ejes = [...new Set(libros.map(l => l.eje_principal || l.eje).filter(Boolean))].sort();
  const hist = consultaHistorial();
  root.innerHTML = `
    <div class="consulta-layout">
      <div class="consulta-panel">
        <h1 class="page-title">Consulta</h1>
        <p class="page-sub">Cuéntame qué necesitas o qué te preocupa y te propongo los libros que mejor lo abordan.</p>
        <form class="consulta-form" onsubmit="consultaEnviar(event)">
          <label class="consulta-label" for="consulta-texto">¿Qué necesitas resolver?</label>
          <textarea id="consulta-texto" class="consulta-texto" rows="4" maxlength="400" placeholder="Por ejemplo: me cuesta concentrarme y acabo mirando el móvil todo el rato…" onkeydown="consultaTecla(event)">${esc(consultaEstado.texto)}</textarea>
          <div class="consulta-fila">
            <select id="consulta-eje" class="consulta-eje" aria-label="Limitar a un eje" onchange="consultaCambiaEje(this.value)">
              <option value="">Todos los ejes</option>
              ${ejes.map(e => `<option value="${escAttr(e)}"${consultaEstado.eje === e ? ' selected' : ''}>${esc(e)}</option>`).join('')}
            </select>
            <button type="submit" class="act-btn primary consulta-btn">Buscar libros</button>
          </div>
        </form>
        <p class="sec-label consulta-sec">Prueba con</p>
        <div class="consulta-chips">
          ${consultaEjemplos().map(e => `<button type="button" class="consulta-chip" data-q="${escAttr(e)}" onclick="consultaEjemplo(this)">${esc(e)}</button>`).join('')}
        </div>
        ${hist.length ? `<p class="sec-label consulta-sec">Tus últimas consultas</p>
        <div class="consulta-chips">${hist.map(e => `<button type="button" class="consulta-chip hist" data-q="${escAttr(e)}" onclick="consultaEjemplo(this)">${esc(e)}</button>`).join('')}</div>` : ''}
        <details class="consulta-como">
          <summary>Cómo funciona</summary>
          <p>No usa inteligencia artificial ni internet: busca en las ideas clave, aplicaciones y textos de las lecciones que ya tienes, y traduce lo que cuentas a los temas de la biblioteca (hábitos, decisiones, negociación…). Por eso te dice en qué se basa cada sugerencia. Si no encaja, reformula con otras palabras.</p>
        </details>
      </div>
      <div class="consulta-resultados" id="consulta-res" aria-live="polite"></div>
    </div>`;
  if (consultaEstado.texto.trim().length >= 3) consultaMostrar();
}

function consultaTecla(ev) {
  if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); consultaEnviar(ev); }
}
function consultaEnviar(ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  const t = document.getElementById('consulta-texto');
  consultaEstado.texto = (t ? t.value : '').trim();
  consultaEstado.verMas = false;
  consultaMostrar(true);
}
function consultaEjemplo(btn) {
  const t = document.getElementById('consulta-texto');
  if (t) t.value = btn.dataset.q;
  consultaEstado.texto = btn.dataset.q;
  consultaEstado.verMas = false;
  consultaMostrar(true);
}
function consultaCambiaEje(v) {
  consultaEstado.eje = v;
  if (consultaEstado.texto.trim().length >= 3) { consultaEstado.verMas = false; consultaMostrar(); }
}
function consultaVerMas() { consultaEstado.verMas = true; consultaMostrar(); }
function consultaTema(texto) {
  const t = document.getElementById('consulta-texto');
  if (t) t.value = texto;
  consultaEstado.texto = texto;
  consultaMostrar(true);
}

const CONSULTA_NIVEL = { alto: ['Encaja muy bien', 'alto'], medio: ['Encaja bien', 'medio'], parcial: ['Encaje parcial', 'parcial'] };

function consultaTarjeta(r, i) {
  const l = r.libro;
  const subE = l.sub_eje || l.eje_principal || '';
  const [etiqueta, cls] = CONSULTA_NIVEL[r.nivel] || CONSULTA_NIVEL.parcial;
  const raicesTodas = [...new Set(r.lecciones.flatMap(x => x.raices))];
  const principal = r.lecciones[0];
  const idea = principal.lec.idea_clave || (principal.lec.cuerpo || '').slice(0, 220);
  const otras = r.lecciones.slice(1);
  const lecN = principal.lec.orden ? `Lección ${principal.lec.orden}` : 'Lección';
  return `<article class="consulta-card nivel-${cls}">
    <div class="consulta-card-top">
      <span class="consulta-n">${i + 1}</span>
      <div class="consulta-card-tit">
        <h3 class="consulta-libro">${esc(l.titulo.split(':')[0])}</h3>
        <p class="consulta-autor">${esc(l.autor || '')}</p>
      </div>
      <span class="consulta-nivel ${cls}">${etiqueta}</span>
    </div>
    <div class="consulta-meta">
      <span class="eje-tag" style="color:${ejeColor(subE)};border-color:${ejeColor(subE)}30;background:${ejeColor(subE)}0a">${esc(subE || '—')}</span>
      ${r.responde && r.responde.length ? `<span class="consulta-responde">Responde a: ${r.responde.map(esc).join(' · ')}</span>` : ''}
    </div>
    <p class="consulta-por"><b>${esc(lecN)}: ${esc(principal.lec.titulo)}</b><br>${Consulta.resaltar(idea, raicesTodas)}</p>
    ${otras.length ? `<p class="consulta-mas">También: ${otras.map(x => esc(x.lec.titulo)).join(' · ')}${r.nLecciones > r.lecciones.length ? ` y ${r.nLecciones - r.lecciones.length} más` : ''}</p>` : ''}
    <div class="consulta-acc">
      <button type="button" class="act-btn primary" onclick="verLeccion('${r.empezarPor.id}','consulta')">Empezar por la ${esc(lecN.toLowerCase())}</button>
      <button type="button" class="act-btn secondary" onclick="verLibro('${l.id}')">Ver el libro</button>
    </div>
  </article>`;
}

function consultaMostrar(guardar) {
  const cont = document.getElementById('consulta-res');
  if (!cont) return;
  const ix = consultaIndice();
  const texto = consultaEstado.texto;
  const r = Consulta.consultar(ix, texto, { eje: consultaEstado.eje || null, max: consultaEstado.verMas ? 12 : 6 });
  if (guardar && !r.crisis) consultaGuardarHistorial(texto);

  if (r.crisis) {
    cont.innerHTML = `<div class="consulta-crisis" role="alert"><p>${esc(r.crisis)}</p></div>`;
    return;
  }
  const entendido = r.temas.length ? `<p class="consulta-entiendo">Entiendo que va de: ${r.temas.map(t => `<span class="consulta-tema">${esc(t.nombre)}</span>`).join('')}</p>` : '';
  const aviso = r.aviso ? `<p class="consulta-aviso">${esc(r.aviso)}</p>` : '';
  if (!r.resultados.length) {
    const msg = r.motivo === 'corto' ? 'Cuéntame un poco más: con unas pocas palabras me basta.'
      : 'No encuentro libros que encajen bien con eso. Prueba con otras palabras (por ejemplo, el problema concreto o lo que quieres conseguir) o elige una de las ideas de arriba.';
    cont.innerHTML = `${entendido}${aviso}<div class="consulta-vacio"><p>${msg}</p>
      <p><button type="button" class="act-btn secondary" onclick="showView('biblioteca')">Ir a la estantería</button></p></div>`;
    return;
  }
  const hayMas = !consultaEstado.verMas && r.resultados.length >= 6;
  cont.innerHTML = `${entendido}${aviso}
    <p class="consulta-n-res">${r.resultados.length} ${r.resultados.length === 1 ? 'libro' : 'libros'} para empezar, del que mejor encaja al que menos</p>
    ${r.resultados.map(consultaTarjeta).join('')}
    ${hayMas ? '<p class="consulta-masbtn"><button type="button" class="act-btn secondary" onclick="consultaVerMas()">Ver más sugerencias</button></p>' : ''}
    <p class="consulta-pie">Basado en las ideas clave y aplicaciones de las lecciones; no es una recomendación personalizada.</p>`;
  if (guardar && window.matchMedia && window.matchMedia('(max-width: 1023px)').matches) cont.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
