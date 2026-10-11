const SUPABASE_URL = 'https://aduizdiiacrvpoavjmab.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdWl6ZGlpYWNydnBvYXZqbWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTg5MDEsImV4cCI6MjA4NzE3NDkwMX0.US2sEhlSBJbcwg93txuL-9AdPKo2LLmdVX5dur7i5GQ';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allLibros = [];
let preguntasPendientes = [];
let libroSeleccionado = null;

// LOGIN — Supabase Auth; la escritura la permite RLS solo a usuarios de public.admins
async function checkLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pwd = document.getElementById('login-input').value;
  const err = document.getElementById('login-error');
  err.style.display = 'none';
  const { error } = await db.auth.signInWithPassword({ email, password: pwd });
  let esAdmin = false;
  if (!error) {
    const r = await db.rpc('is_admin');
    esAdmin = r.data === true;
    if (!esAdmin) await db.auth.signOut();
  }
  if (error || !esAdmin) { err.style.display = 'block'; return; }
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-screen').classList.add('active');
  cargarLibros();
}

// NAVIGATION
function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).style.display = 'block';
  const tabs = ['nuevo-libro', 'generar', 'corpus', 'infografias', 'metricas', 'preguntas'];
  const idx = tabs.indexOf(name);
  document.querySelectorAll('.nav-btn')[idx].classList.add('active');
  if (name === 'corpus') renderCorpus();
  if (name === 'infografias') cargarInfografias();
  if (name === 'metricas') cargarMetricas(30);
  if (name === 'preguntas') cargarPreguntasLeccion();
}

// INFOGRAFÍAS — revisión: aprobar o rechazar (rechazada = el generador la rehace en la próxima tanda)
const escH = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
async function cargarInfografias() {
  const box = document.getElementById('info-lista');
  box.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">Cargando...</div>';
  const { data, error } = await db.from('libros')
    .select('id,titulo,autor,infografia_url,infografia_estado,infografia_modelo,infografia_prompt')
    .eq('infografia_estado', 'pendiente').order('infografia_at', { ascending: true });
  if (error) { box.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">No se pudo cargar (¿está aplicada la migración de infografías?).</div>'; return; }
  if (!data.length) { box.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">Nada pendiente de revisar.</div>'; return; }
  box.innerHTML = data.map(l => `
    <div class="info-item" id="info-${escH(l.id)}" style="display:flex;gap:1rem;align-items:flex-start;margin:1rem 0;padding-bottom:1rem;border-bottom:1px solid var(--border);flex-wrap:wrap;">
      <a href="${escH(l.infografia_url)}" target="_blank" rel="noopener"><img src="${escH(l.infografia_url)}" alt="" style="width:220px;max-width:100%;border-radius:8px;border:1px solid var(--border);"></a>
      <div style="flex:1;min-width:200px;">
        <div style="font-weight:600;">${escH(l.titulo)}</div>
        <div style="color:var(--text-dim);font-size:0.85rem;margin-bottom:0.6rem;">${escH(l.autor)} · ${escH(l.infografia_modelo || '')}</div>
        <div style="display:flex;gap:0.6rem;flex-wrap:wrap;">
          <button class="btn" onclick="revisarInfografia('${escH(l.id)}','aprobada')">Aprobar</button>
          <button class="btn-secondary" onclick="revisarInfografia('${escH(l.id)}','rechazada')">Rechazar</button>
        </div>
      </div>
    </div>`).join('');
}
async function revisarInfografia(id, estado) {
  const { error } = await db.from('libros').update({ infografia_estado: estado }).eq('id', id);
  if (error) { alert('No se pudo guardar: ' + error.message); return; }
  const el = document.getElementById('info-' + id);
  if (el) el.remove();
  if (!document.querySelector('#info-lista .info-item')) document.getElementById('info-lista').innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">Nada pendiente de revisar.</div>';
}

// CARGAR LIBROS
async function cargarLibros() {
  const { data } = await db.from('libros').select('*').order('eje');
  if (data) {
    allLibros = data;
    const select = document.getElementById('gen-libro-select');
    select.innerHTML = '<option value="">Selecciona un libro...</option>' +
      data.map(l => { const e=s=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); return `<option value="${l.id}">${e(l.autor)} — ${e(l.titulo)}</option>`; }).join('');
  }
}

// LOG HELPER
function log(containerId, msg, type = '') {
  const box = document.getElementById(containerId);
  const line = document.createElement('div');
  line.className = type ? 'log-' + type : '';
  line.textContent = '> ' + msg;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function clearLog(containerId) {
  document.getElementById(containerId).innerHTML = '';
}

// GUARDAR LIBRO
async function guardarLibro() {
  clearLog('log-nuevo-libro');

  const autor = document.getElementById('nuevo-autor').value.trim();
  const titulo = document.getElementById('nuevo-titulo').value.trim();
  const ejeSelect = document.getElementById('nuevo-eje').value;
  const ejeCustom = document.getElementById('nuevo-eje-custom').value.trim();
  const eje = ejeSelect === 'Nuevo eje' ? ejeCustom : ejeSelect;
  const descripcion = document.getElementById('nuevo-descripcion').value.trim();
  const leccionTitulo = document.getElementById('leccion-titulo').value.trim();
  const leccionCuerpo = document.getElementById('leccion-cuerpo').value.trim();
  const leccionConexion = document.getElementById('leccion-conexion').value.trim();
  const leccionAuto = document.getElementById('leccion-autocorreccion').value.trim();
  const leccionAutores = document.getElementById('leccion-autores').value.trim()
    .split(',').map(a => a.trim()).filter(Boolean);

  if (!autor || !titulo || !eje || !leccionTitulo || !leccionCuerpo) {
    log('log-nuevo-libro', 'Rellena al menos: autor, título, eje, título y cuerpo de la lección.', 'err');
    return;
  }

  log('log-nuevo-libro', 'Guardando libro...', 'info');

  const { data: libroData, error: libroError } = await db
    .from('libros')
    .insert({ autor, titulo, eje, descripcion_breve: descripcion })
    .select()
    .single();

  if (libroError) { log('log-nuevo-libro', 'Error: ' + libroError.message, 'err'); return; }
  log('log-nuevo-libro', 'Libro guardado: ' + libroData.id, 'ok');

  const { error: leccionError } = await db.from('lecciones').insert({
    libro_id: libroData.id,
    titulo: leccionTitulo,
    cuerpo: leccionCuerpo,
    conexion_cruzada: leccionConexion || null,
    autocorreccion: leccionAuto || null,
    autores_relacionados: leccionAutores.length > 0 ? leccionAutores : null,
    orden: 1
  });

  if (leccionError) { log('log-nuevo-libro', 'Error lección: ' + leccionError.message, 'err'); return; }
  log('log-nuevo-libro', 'Lección guardada correctamente.', 'ok');
  log('log-nuevo-libro', 'Ahora ve a "Generar preguntas" para crear el test de este libro.', 'info');

  // Limpiar form
  ['nuevo-autor','nuevo-titulo','nuevo-descripcion','leccion-titulo','leccion-cuerpo',
   'leccion-conexion','leccion-autocorreccion','leccion-autores','nuevo-eje-custom'].forEach(id => {
    document.getElementById(id).value = '';
  });

  await cargarLibros();
}

// GENERAR PREGUNTAS CON CLAUDE
async function generarPreguntas() {
  clearLog('log-generar');
  const libroId = document.getElementById('gen-libro-select').value;
  const contextoExtra = document.getElementById('gen-contexto').value.trim();

  if (!libroId) { log('log-generar', 'Selecciona un libro primero.', 'err'); return; }

  const libro = allLibros.find(l => l.id === libroId);
  if (!libro) { log('log-generar', 'Libro no encontrado.', 'err'); return; }

  // Cargar lección del libro
  const { data: lecciones } = await db.from('lecciones').select('*').eq('libro_id', libroId).limit(1);
  const leccion = lecciones && lecciones[0] ? lecciones[0] : null;

  log('log-generar', 'Conectando con Claude...', 'info');
  document.getElementById('btn-generar').disabled = true;

  const prompt = `Eres un sistema de evaluación de conocimiento profundo del corpus filosófico-financiero del Segundo Cerebro Soberano. El marco de análisis usa termodinámica, biología evolutiva y Escuela Austriaca como filtros. Cero sofismo, cero relativismo. Verdad objetiva aunque sea incómoda.

Libro a evaluar: "${libro.titulo}" de ${libro.autor}
Eje temático: ${libro.eje}
Descripción: ${libro.descripcion_breve || ''}
${leccion ? `Contenido de la lección: ${leccion.cuerpo}` : ''}
${leccion && leccion.conexion_cruzada ? `Conexiones cruzadas con el corpus: ${leccion.conexion_cruzada}` : ''}
${leccion && leccion.autocorreccion ? `Autocorrección del autor: ${leccion.autocorreccion}` : ''}
${contextoExtra ? `Contexto adicional: ${contextoExtra}` : ''}

Genera 4 preguntas de opción múltiple que evalúen:
1. Un concepto central no obvio del libro
2. Una conexión cruzada con otro autor del corpus
3. Una aplicación práctica a mercados o desarrollo personal
4. Una limitación o autocorrección del marco del autor

Para cada pregunta:
- Texto claro y específico
- 4 opciones (solo una correcta, las otras plausibles pero incorrectas)
- IMPORTANTE: las 3 incorrectas deben medir entre el 80 % y el 120 % de la correcta, con el mismo nivel de detalle y la misma estructura gramatical. La correcta NO debe ser la más larga ni la más matizada. Cada incorrecta es un error conceptual realista y distinto (inversión causa/efecto, sobregeneralización, confusión con un concepto cercano), nunca una negación trivial. Prohibido «todas las anteriores», «ninguna» o «A y B».
- Atribuye al autor solo lo que dice el libro; separa lo que dice el libro de tu propia síntesis, y no inventes cifras ni citas.
- Índice de la correcta (0-3); no importa cuál, se barajará después
- Explicación de 2-3 líneas que conecte con el corpus
- Dificultad: 1 (fácil), 2 (medio), 3 (difícil)

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
[{"texto":"...","opciones":["...","...","...","..."],"correcta":0,"explicacion":"...","dificultad":2}]`;

  try {
    const { data: sesion } = await db.auth.getSession();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generar-preguntas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${sesion.session ? sesion.session.access_token : ''}`
      },
      body: JSON.stringify({ prompt: prompt })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: response.statusText }));
      log('log-generar', 'Error API: ' + (errData.error || response.statusText), 'err');
      document.getElementById('btn-generar').disabled = false;
      return;
    }

    const data = await response.json();
    const rawText = data.content[0].text.trim();

    let preguntas;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      preguntas = JSON.parse(clean);
    } catch(e) {
      log('log-generar', 'Error parseando respuesta: ' + e.message, 'err');
      log('log-generar', 'Respuesta raw: ' + rawText.substring(0, 200), 'err');
      document.getElementById('btn-generar').disabled = false;
      return;
    }

    // Se baraja aquí (el modelo tiende a poner la correcta en A o B) y se avisa de los avisos de forma.
    preguntas = preguntas.map(p => window.OpcionesQ.barajarOpciones(p));
    preguntas.forEach((p, i) => {
      const f = window.OpcionesQ.revisarPregunta(p);
      if (f.length) log('log-generar', 'Pregunta ' + (i + 1) + ': ' + f.join('; '), 'err');
    });
    log('log-generar', preguntas.length + ' preguntas generadas. Revisa antes de guardar.', 'ok');

    libroSeleccionado = libro;
    preguntasPendientes = preguntas;
    renderPreguntasGeneradas(preguntas, libro);

  } catch(e) {
    log('log-generar', 'Error de conexión: ' + e.message, 'err');
  }

  document.getElementById('btn-generar').disabled = false;
}

function renderPreguntasGeneradas(preguntas, libro) {
  const letras = ['A', 'B', 'C', 'D'];
  const e=s=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const container = document.getElementById('preguntas-generadas-list');
  container.innerHTML = preguntas.map((p, i) => `
    <div class="pregunta-generada">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;letter-spacing:0.1em;color:var(--accent);margin-bottom:0.5rem;">PREGUNTA ${i+1} — DIF ${p.dificultad || 2}</div>
      <div class="pg-texto">${e(p.texto)}</div>
      <div class="pg-opciones">
        ${(p.opciones||[]).map((op, j) => `
          <div class="pg-opcion ${j === p.correcta ? 'correcta' : ''}">
            ${letras[j]}. ${e(op)} ${j === p.correcta ? '✓' : ''}
          </div>`).join('')}
      </div>
      <div class="pg-explicacion">${e(p.explicacion)}</div>
    </div>`).join('');

  document.getElementById('preguntas-generadas-container').style.display = 'block';
}

async function guardarPreguntasGeneradas() {
  if (!preguntasPendientes.length || !libroSeleccionado) return;
  clearLog('log-generar');
  log('log-generar', 'Guardando ' + preguntasPendientes.length + ' preguntas...', 'info');

  const rows = preguntasPendientes.map(p => ({
    libro_id: libroSeleccionado.id,
    eje: libroSeleccionado.eje,
    texto: p.texto,
    opciones: p.opciones,
    correcta: p.correcta,
    explicacion: p.explicacion,
    dificultad: p.dificultad || 2
  }));

  const { error } = await db.from('preguntas').insert(rows);

  if (error) {
    log('log-generar', 'Error: ' + error.message, 'err');
    return;
  }

  log('log-generar', 'Preguntas guardadas correctamente en Supabase.', 'ok');
  descartarGeneradas();
}

function descartarGeneradas() {
  preguntasPendientes = [];
  libroSeleccionado = null;
  document.getElementById('preguntas-generadas-container').style.display = 'none';
  document.getElementById('preguntas-generadas-list').innerHTML = '';
  document.getElementById('gen-contexto').value = '';
}

// CORPUS
async function renderCorpus() {
  const container = document.getElementById('corpus-list');
  container.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">Cargando...</div>';

  const { data: libros } = await db.from('libros').select('*').order('eje');
  const { data: lecciones } = await db.from('lecciones').select('libro_id');
  const { data: preguntas } = await db.from('preguntas').select('libro_id');

  if (!libros) { container.innerHTML = '<div style="color:var(--danger);">Error cargando corpus.</div>'; return; }

  const leccionCount = {};
  const preguntaCount = {};
  if (lecciones) lecciones.forEach(l => { leccionCount[l.libro_id] = (leccionCount[l.libro_id] || 0) + 1; });
  if (preguntas) preguntas.forEach(p => { preguntaCount[p.libro_id] = (preguntaCount[p.libro_id] || 0) + 1; });

  container.innerHTML = `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:0.65rem;color:var(--text-dim);margin-bottom:1rem;letter-spacing:0.05em;">
      ${libros.length} libros · ${Object.values(leccionCount).reduce((a,b)=>a+b,0)} lecciones · ${Object.values(preguntaCount).reduce((a,b)=>a+b,0)} preguntas
    </div>
    ${libros.map(l => { const e=s=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); return `
      <div class="libro-item">
        <div class="libro-eje">${e(l.eje)}</div>
        <div class="libro-info">
          <div class="libro-titulo">${e(l.titulo)}</div>
          <div class="libro-autor">${e(l.autor)}</div>
        </div>
        <div class="libro-counts">
          <div>${leccionCount[l.id] || 0} lec.</div>
          <div>${preguntaCount[l.id] || 0} preg.</div>
        </div>
      </div>`; }).join('')}`;
}


// MÉTRICAS — cifras de uso a partir de `eventos` (lib/metricas.js)
const hoyLogico = () => new Date(Date.now() - 4 * 3600 * 1000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });   // día lógico: corte a las 04:00, hora de Madrid
const nz = v => (v == null ? '—' : v);
const mmss = s => (s == null ? '—' : Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s');
async function cargarMetricas(dias) {
  const box = document.getElementById('met-cuerpo');
  box.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">Cargando...</div>';
  const hoy = hoyLogico();
  const desde = Metricas.sumaDias(hoy, -Math.max(dias, 35));      // D30 necesita mirar un poco más atrás
  const { data, error } = await db.from('eventos').select('usuario_id,dia,tipo,props').gte('dia', desde).limit(20000);
  if (error) { box.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">No se pudo cargar (¿está aplicada la migración de eventos?).</div>'; return; }
  const r = Metricas.resumen(data || [], hoy, dias);
  const card = (t, v, sub) => `<div style="flex:1;min-width:150px;border:1px solid var(--border);border-radius:10px;padding:0.8rem 1rem;">
      <div style="color:var(--text-dim);font-size:0.75rem;">${escH(t)}</div><div style="font-size:1.5rem;font-weight:600;">${escH(v)}</div>
      <div style="color:var(--text-dim);font-size:0.75rem;">${escH(sub || '')}</div></div>`;
  const s = r.sesiones, a = r.actividad, ret = r.retencion;
  const maxSerie = Math.max(1, ...r.serie.map(d => d.sesiones + d.lecturas + d.tarjetas));
  const barras = r.serie.map(d => {
    const n = d.sesiones + d.lecturas + d.tarjetas;
    return `<div title="${escH(d.dia)}: ${d.sesiones} sesiones · ${d.lecturas} lecturas · ${d.tarjetas} tarjetas" style="flex:1;min-width:3px;background:var(--accent,#c9a84c);opacity:${n ? 0.85 : 0.15};height:${Math.max(3, Math.round(n / maxSerie * 60))}px;border-radius:2px;"></div>`;
  }).join('');
  const aba = Object.entries(s.abandonoPorPaso).sort((x, y) => y[1] - x[1]);
  box.innerHTML = `
    <div style="display:flex;gap:0.8rem;flex-wrap:wrap;margin-bottom:1.2rem;">
      ${card('Sesiones empezadas', s.empezadas, `${s.cerradas} cerradas · ${s.abandonadas} abandonadas`)}
      ${card('Finalización', s.finalizacion == null ? '—' : s.finalizacion + ' %', 'cerradas / empezadas')}
      ${card('Duración mediana', mmss(s.segundosMediana), 'de las sesiones cerradas')}
      ${card('Días con actividad', a.diasConActividad, `en los últimos ${r.dias} días`)}
    </div>
    <div style="display:flex;gap:0.8rem;flex-wrap:wrap;margin-bottom:1.2rem;">
      ${card('Retención D1', ret.d1.pct == null ? '—' : ret.d1.pct + ' %', `${ret.d1.vuelven} de ${ret.d1.base}`)}
      ${card('Retención D7', ret.d7.pct == null ? '—' : ret.d7.pct + ' %', `${ret.d7.vuelven} de ${ret.d7.base}`)}
      ${card('Retención D30', ret.d30.pct == null ? '—' : ret.d30.pct + ' %', `${ret.d30.vuelven} de ${ret.d30.base} (días 25–35)`)}
      ${card('Compromisos cumplidos', r.compromisos.cumplidos == null ? '—' : r.compromisos.cumplidos + ' %', `${r.compromisos.si} sí · ${r.compromisos.a_medias} a medias · ${r.compromisos.no} no`)}
    </div>
    <div class="section-sub" style="margin-top:1rem;">Actividad diaria (sesiones + lecturas + tarjetas)</div>
    <div style="display:flex;gap:2px;align-items:flex-end;height:64px;margin-bottom:1.2rem;">${barras}</div>
    <div class="section-sub">Dónde se abandona la sesión</div>
    <div style="margin-bottom:1.2rem;font-size:0.9rem;">${aba.length ? aba.map(([k, n]) => `<div>${escH(k)}: <b>${n}</b></div>`).join('') : '<span style="color:var(--text-dim);">Sin abandonos registrados.</span>'}</div>
    <div class="section-sub">Onboarding y comprobación</div>
    <div style="font-size:0.9rem;">
      Onboarding: ${r.onboarding.iniciado} iniciados · ${r.onboarding.completado} completados · ${r.onboarding.omitido} «ahora no»<br>
      «Comprueba»: ${r.comprobacion.total} respuestas${r.comprobacion.pct == null ? '' : ` · ${r.comprobacion.pct} % de acierto`}<br>
      Eventos en la ventana: ${r.eventos}
    </div>`;
}

// PREGUNTAS ↔ LECCIÓN — revisión de las emparejadas y asignación de las que faltan
async function cargarPreguntasLeccion() {
  const box = document.getElementById('pq-lista');
  const filtro = document.getElementById('pq-filtro').value;
  box.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">Cargando...</div>';
  let q = db.from('preguntas').select('id,libro_id,texto,leccion_id,leccion_origen').eq('activa', true).order('libro_id').limit(40);
  q = filtro === 'sin' ? q.is('leccion_id', null) : q.eq('leccion_origen', filtro);
  const { data, error } = await q;
  if (error) { box.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">No se pudo cargar (¿está aplicada la migración de preguntas?).</div>'; return; }
  const [{ count: total }, { count: sin }] = await Promise.all([
    db.from('preguntas').select('id', { count: 'exact', head: true }).eq('activa', true),
    db.from('preguntas').select('id', { count: 'exact', head: true }).eq('activa', true).is('leccion_id', null)
  ]);
  document.getElementById('pq-resumen').textContent = `${(total || 0) - (sin || 0)} de ${total || 0} preguntas con lección · mostrando hasta 40`;
  if (!data.length) { box.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">Nada en este filtro.</div>'; return; }
  const libros = [...new Set(data.map(p => p.libro_id))];
  const { data: lecs } = await db.from('lecciones').select('id,libro_id,titulo,orden').in('libro_id', libros).eq('activa', true).order('orden');
  const porLibro = {};
  (lecs || []).forEach(l => (porLibro[l.libro_id] = porLibro[l.libro_id] || []).push(l));
  box.innerHTML = data.map(p => {
    const ops = (porLibro[p.libro_id] || []).map(l => `<option value="${escH(l.id)}"${l.id === p.leccion_id ? ' selected' : ''}>${escH(l.titulo)}</option>`).join('');
    return `<div id="pq-${escH(p.id)}" style="margin:0.8rem 0;padding-bottom:0.8rem;border-bottom:1px solid var(--border);">
      <div style="font-size:0.9rem;margin-bottom:0.4rem;">${escH(p.texto)}</div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
        <select id="pqs-${escH(p.id)}" style="flex:1;min-width:220px;max-width:100%;padding:0.35rem;background:var(--surface,#151c26);color:inherit;border:1px solid var(--border);border-radius:6px;">
          <option value="">— sin lección —</option>${ops}</select>
        <button class="btn" onclick="guardarPreguntaLeccion('${escH(p.id)}')">Guardar</button>
      </div></div>`;
  }).join('');
}
async function guardarPreguntaLeccion(id) {
  const v = document.getElementById('pqs-' + id).value || null;
  const { error } = await db.from('preguntas').update({ leccion_id: v, leccion_origen: v ? 'manual' : null }).eq('id', id);
  const fila = document.getElementById('pq-' + id);
  if (error) { fila.style.outline = '1px solid #c0392b'; return; }
  fila.style.opacity = '0.4';
}
