#!/usr/bin/env node
/**
 * Genera el «mapa visual» (infografía) de cada libro con un modelo de imagen y lo deja
 * pendiente de revisión. Por defecto es una SIMULACIÓN: no llama a ninguna API de pago.
 *
 *   node tools/infografias/generar.mjs                       # simulación: muestra encargos y coste
 *   node tools/infografias/generar.mjs --ejecutar --limite 3 # genera de verdad (necesita claves)
 *
 * Variables de entorno (solo para --ejecutar):
 *   OPENAI_API_KEY    clave de la API de imágenes
 *   ADMIN_EMAIL, ADMIN_PASSWORD   usuario administrador de Supabase (public.admins). No se usa la
 *                     service role: las escrituras pasan por las políticas RLS de administrador.
 * Opcionales: SUPABASE_URL, SUPABASE_ANON_KEY, OPENAI_BASE_URL, IMAGE_MODEL (gpt-image-1.5), IMAGE_QUALITY (medium)
 *
 * Opciones: --libro <id>  --limite <n> (3)  --calidad low|medium|high  --modelo <id>  --max-coste <USD> (3)
 *           --ejecutar  --solo-rechazadas
 */
import Infografia from '../../lib/infografia.js';

const SB_URL_DEFECTO = 'https://aduizdiiacrvpoavjmab.supabase.co';
// Clave anónima pública de la app (la misma que va en app.js); solo permite lo que permite RLS.
const SB_ANON_DEFECTO = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdWl6ZGlpYWNydnBvYXZqbWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTg5MDEsImV4cCI6MjA4NzE3NDkwMX0.US2sEhlSBJbcwg93txuL-9AdPKo2LLmdVX5dur7i5GQ';

export function leerArgs(argv) {
  const o = { ejecutar: false, limite: 3, calidad: null, modelo: null, maxCoste: 3, libro: null, soloRechazadas: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = () => argv[++i];
    if (a === '--ejecutar') o.ejecutar = true;
    else if (a === '--libro') o.libro = v();
    else if (a === '--limite') o.limite = Math.max(1, parseInt(v(), 10) || 3);
    else if (a === '--calidad') o.calidad = v();
    else if (a === '--modelo') o.modelo = v();
    else if (a === '--max-coste') o.maxCoste = parseFloat(v());
    else if (a === '--solo-rechazadas') o.soloRechazadas = true;
    else throw new Error(`Opción desconocida: ${a}`);
  }
  return o;
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

/** fetch con reintentos ante 429 y 5xx. */
async function pedir(fetchFn, url, init, { intentos = 3, pausa = 1500 } = {}) {
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    const r = await fetchFn(url, init);
    if (r.ok) return r;
    ultimo = r;
    if (r.status !== 429 && r.status < 500) break;
    await esperar(pausa * (i + 1));
  }
  const cuerpo = await ultimo.text().catch(() => '');
  throw new Error(`${init.method || 'GET'} ${url.replace(/\?.*/, '')} → ${ultimo.status} ${cuerpo.slice(0, 300)}`);
}

export async function ejecutar(opts, env = process.env, deps = {}) {
  const fetchFn = deps.fetch || fetch;
  const log = deps.log || console.log;
  const pausa = deps.pausa == null ? 1500 : deps.pausa;
  const SB = (env.SUPABASE_URL || SB_URL_DEFECTO).replace(/\/$/, '');
  const ANON = env.SUPABASE_ANON_KEY || SB_ANON_DEFECTO;
  const OPENAI = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const modelo = opts.modelo || env.IMAGE_MODEL || 'gpt-image-1.5';
  const calidad = opts.calidad || env.IMAGE_QUALITY || 'medium';
  const rest = (path, init = {}, token) => pedir(fetchFn, `${SB}/rest/v1/${path}`, {
    ...init, headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}`, 'Content-Type': 'application/json', ...(init.headers || {}) }
  }, { pausa });

  // 1. Libros candidatos
  let libros;
  try {
    libros = await (await rest('libros?select=id,titulo,autor,descripcion_breve,infografia_url,infografia_estado&publico=eq.true&order=fecha_creacion.asc')).json();
  } catch (e) {
    if (opts.ejecutar) throw new Error('Faltan las columnas infografia_* en libros: aplica antes supabase/migrations/20261012_infografias.sql. ' + e.message);
    log('Aviso: la migración 20261012_infografias.sql aún no está aplicada; se simula con todos los libros.');
    libros = await (await rest('libros?select=id,titulo,autor,descripcion_breve&publico=eq.true&order=fecha_creacion.asc')).json();
  }
  let candidatos = libros.filter(l => opts.libro ? l.id === opts.libro
    : opts.soloRechazadas ? l.infografia_estado === 'rechazada'
    : !l.infografia_url || l.infografia_estado === 'rechazada');
  if (opts.libro && !candidatos.length) throw new Error(`No existe el libro ${opts.libro}`);
  const total = candidatos.length;
  candidatos = candidatos.slice(0, opts.limite);

  const estimado = Infografia.coste(candidatos.length, calidad, modelo);
  log(`Modelo ${modelo} · calidad ${calidad} · ${candidatos.length} de ${total} libros pendientes` +
      (estimado == null ? ' · coste desconocido para este modelo' : ` · coste estimado ≈ $${estimado.toFixed(2)}`));
  if (opts.ejecutar && estimado != null && estimado > opts.maxCoste) {
    throw new Error(`El coste estimado ($${estimado.toFixed(2)}) supera el tope --max-coste ($${opts.maxCoste}). Baja --limite o sube el tope.`);
  }

  // 2. Encargos
  const trabajos = [];
  for (const l of candidatos) {
    const lecs = await (await rest(`lecciones?select=id,titulo,orden,idea_clave&libro_id=eq.${l.id}&activa=eq.true&order=orden.asc`)).json();
    const enc = Infografia.construirPrompt(l, lecs);
    trabajos.push({ libro: l, ...enc });
    if (!opts.ejecutar) log(`\n── ${l.titulo} (${l.id}) ──\n${enc.prompt}`);
  }
  if (!opts.ejecutar) { log(`\nSimulación terminada: no se ha llamado a ninguna API de pago ni se ha escrito nada. Usa --ejecutar para generar.`); return { simulacion: true, trabajos }; }

  // 3. Claves y sesión de administrador
  if (!env.OPENAI_API_KEY) throw new Error('Falta OPENAI_API_KEY');
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) throw new Error('Faltan ADMIN_EMAIL y ADMIN_PASSWORD');
  const sesion = await (await pedir(fetchFn, `${SB}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD })
  }, { pausa })).json();
  const token = sesion.access_token;
  if (!token) throw new Error('No se pudo iniciar sesión como administrador');

  // 4. Generar, subir, dejar pendiente de revisión
  const hechos = [], fallos = [];
  for (const t of trabajos) {
    try {
      const gen = await (await pedir(fetchFn, `${OPENAI}/images/generations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelo, prompt: t.prompt, size: Infografia.SIZE, quality: calidad, n: 1, output_format: 'webp', output_compression: 85 })
      }, { pausa })).json();
      const b64 = gen.data && gen.data[0] && gen.data[0].b64_json;
      if (!b64) throw new Error('La API no devolvió imagen');
      const ruta = `libros/${t.libro.id}.webp`;
      await pedir(fetchFn, `${SB}/storage/v1/object/infografias/${ruta}`, {
        method: 'POST',
        headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'image/webp', 'x-upsert': 'true' },
        body: Buffer.from(b64, 'base64')
      }, { pausa });
      const url = `${SB}/storage/v1/object/public/infografias/${ruta}?v=${Date.now()}`;
      await rest(`libros?id=eq.${t.libro.id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ infografia_url: url, infografia_estado: 'pendiente', infografia_prompt: t.prompt, infografia_modelo: `${modelo}:${calidad}`, infografia_at: new Date().toISOString() })
      }, token);
      log(`✓ ${t.libro.titulo}`);
      hechos.push(t.libro.id);
    } catch (e) {
      log(`✗ ${t.libro.titulo}: ${e.message}`);
      fallos.push({ id: t.libro.id, error: e.message });
    }
  }
  log(`\nHecho: ${hechos.length} generadas, ${fallos.length} con error. Quedan pendientes de revisión en admin.html → Infografías.`);
  return { hechos, fallos };
}

// Ejecución directa por línea de comandos
if (import.meta.url === `file://${process.argv[1]}`) {
  ejecutar(leerArgs(process.argv.slice(2))).then(r => { if (r.fallos && r.fallos.length) process.exitCode = 1; })
    .catch(e => { console.error('Error:', e.message); process.exit(1); });
}
