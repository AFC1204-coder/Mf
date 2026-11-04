/* ═══════════════════════════════════════════
   INICIO — debajo del mazo de fichas, de arriba abajo:
   1) «Hoy»: la sesión de cinco minutos (señal clara, un solo botón),
   2) buscar y temas (lo que más se usa: entrar a la biblioteca por un tema),
   3) esquemas para mirar (algo visual que invite a entrar).
   Usa los globales de app.js (lecs, libros, esc, Diagrama, EJES_CONFIG, Mazo, Dia, completadasSet, …).
═══════════════════════════════════════════ */
let inicioEsqDia = null, inicioEsqLista = [];

/** 1 · Sesión de hoy: pasos en una fila, empezar o solo recordar; si ya está hecha, el resumen. */
function inicioHoyHtml() {
  if (typeof sesPlan !== 'function' || typeof sesionResumenHoy !== 'function') return '';
  const hecho = sesionResumenHoy();
  if (hecho && hecho.texto) {
    return `<div class="ih-card ih-hecho"><p class="ih-k">Hoy · hecho</p><p class="ih-t">${esc(hecho.texto)}</p>
      <p class="ih-nota">Volver mañana es lo que cuenta.</p></div>`;
  }
  const { lec, plan } = sesPlan(false);
  if (!plan || plan.vacia) return '';
  const det = {
    recuerda: p => `${p.n} ${p.n === 1 ? 'idea' : 'ideas'}`,
    lee: p => `${p.min} min`,
    comprueba: () => '1 pregunta',
    lleva: () => 'una acción'
  };
  const pasos = plan.pasos.map(p => `<li><b>${p.etiqueta}</b><span>${(det[p.k] || (() => ''))(p)}</span></li>`).join('');
  const solo = (sesPrecarga && sesPrecarga.tarjetas && sesPrecarga.tarjetas.length && lec)
    ? `<button type="button" class="ih-ghost" onclick="sesionEmpezar(true)">Solo recordar</button>` : '';
  return `<div class="ih-card">
    <p class="ih-k">Tu sesión de hoy · ${plan.minutos} min</p>
    <ol class="ih-pasos">${pasos}</ol>
    <div class="ih-acc"><button type="button" class="ih-go" onclick="sesionEmpezar(false)">Empezar</button>${solo}</div>
  </div>`;
}

/** 2 · Buscar y temas. */
function inicioExplorarHtml() {
  const chips = Object.entries(EJES_CONFIG || {}).map(([n, cfg]) =>
    `<button type="button" class="ie-chip" data-eje="${esc(n)}" onclick="inicioEje(this.dataset.eje)">${cfg.icon || ''}<span>${esc(n)}</span></button>`).join('');
  return `<button type="button" class="ie-buscar" onclick="toggleSpotlight()">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <span>Busca un tema, un libro o una idea</span></button>
    <div class="ie-chips" role="list">${chips}</div>`;
}
function inicioEje(eje) {
  if (typeof showView === 'function') showView('biblioteca');
  const btn = [...document.querySelectorAll('#eje-filters .eje-pill')].find(b => b.textContent.includes(eje));
  if (btn && typeof filtrarEjePrincipal === 'function') filtrarEjePrincipal(eje, btn);
}

/** 3 · Esquemas para mirar: lecciones con esquema, sin leer primero, de libros distintos; estable durante el día. */
function inicioEsquemasLista() {
  const hoy = (typeof Dia !== 'undefined') ? Dia.hoy() : new Date().toISOString().slice(0, 10);
  if (inicioEsqDia === hoy && inicioEsqLista.length && !(typeof mazoFichas !== 'undefined' && mazoFichas && mazoFichas.some(f => inicioEsqLista.includes(f.lecId)))) return inicioEsqLista;
  const comp = completadasSet();
  const yaSale = new Set((typeof mazoFichas !== 'undefined' && mazoFichas ? mazoFichas : []).map(f => f.lecId).filter(Boolean));
  const rnd = Mazo.azar(Mazo.semillaDe('esq' + hoy));
  const cands = lecs.filter(l => { try { return !yaSale.has(l.id) && Diagrama.deLeccion(l).length > 0; } catch (e) { return false; } });
  const barajar = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sinLeer = barajar(cands.filter(l => !comp.has(l.id))), leidas = barajar(cands.filter(l => comp.has(l.id)));
  const out = [], libs = new Set();
  for (const l of sinLeer.concat(leidas)) {
    if (libs.has(l.libro_id)) continue;
    libs.add(l.libro_id); out.push(l.id);
    if (out.length >= 6) break;
  }
  inicioEsqDia = hoy; inicioEsqLista = out;
  return out;
}
function inicioEsquemasHtml() {
  const ids = inicioEsquemasLista();
  if (!ids.length) return '';
  const tarjetas = ids.map(id => {
    const lec = lecs.find(l => l.id === id); if (!lec) return '';
    const fig = Diagrama.deLeccion(lec).slice(0, 1).map(Diagrama.render).join('');
    if (!fig) return '';
    const libro = libros.find(l => l.id === lec.libro_id);
    return `<button type="button" class="ie-esq" onclick="abrirFolioAtril('${lec.id}')" aria-label="${esc(lec.titulo)}">
      <span class="ie-fig">${fig}</span>
      <span class="ie-et">${esc(lec.titulo)}</span>
      <span class="ie-lb">${libro ? esc(libro.titulo) : ''}</span></button>`;
  }).join('');
  if (!tarjetas.trim()) return '';
  return `<p class="sec-label">Esquemas para mirar</p><div class="ie-esq-fila">${tarjetas}</div>`;
}

function renderInicio() {
  const poner = (id, html) => { const el = document.getElementById(id); if (el) { el.innerHTML = html; el.hidden = !html; } };
  try { poner('inicio-hoy', inicioHoyHtml()); } catch (e) { poner('inicio-hoy', ''); }
  try { poner('inicio-explorar', inicioExplorarHtml()); } catch (e) { poner('inicio-explorar', ''); }
  try { poner('inicio-esquemas', lecs && lecs.length ? inicioEsquemasHtml() : ''); } catch (e) { poner('inicio-esquemas', ''); }
}
