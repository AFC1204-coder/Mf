const SUPABASE_URL = 'https://aduizdiiacrvpoavjmab.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdWl6ZGlpYWNydnBvYXZqbWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTg5MDEsImV4cCI6MjA4NzE3NDkwMX0.US2sEhlSBJbcwg93txuL-9AdPKo2LLmdVX5dur7i5GQ';
const ADMIN_HASH = '94b371e3f19434d45d7dbd5fe23efd511caa57ccdc84d794c5feaf371d888c54';
let adminSessionPwd = null;

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allLibros = [];
let preguntasPendientes = [];
let libroSeleccionado = null;

// LOGIN
async function checkLogin() {
  const pwd = document.getElementById('login-input').value;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd));
  const hash = [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  if (hash === ADMIN_HASH) {
    adminSessionPwd = pwd;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-screen').classList.add('active');
    cargarLibros();
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
}

// NAVIGATION
function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).style.display = 'block';
  const tabs = ['nuevo-libro', 'generar', 'corpus'];
  const idx = tabs.indexOf(name);
  document.querySelectorAll('.nav-btn')[idx].classList.add('active');
  if (name === 'corpus') renderCorpus();
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
- Índice de la correcta (0-3)
- Explicación de 2-3 líneas que conecte con el corpus
- Dificultad: 1 (fácil), 2 (medio), 3 (difícil)

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
[{"texto":"...","opciones":["...","...","...","..."],"correcta":0,"explicacion":"...","dificultad":2}]`;

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generar-preguntas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        admin_password: adminSessionPwd,
        prompt: prompt
      })
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
