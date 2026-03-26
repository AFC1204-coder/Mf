/**
 * Funciones puras extraídas de app.js para testing.
 * app.js sigue siendo la fuente de verdad en producción;
 * este módulo replica la lógica exacta para poder verificarla.
 */

/* ── FORMAT TEXT (markdown → HTML) ── */
export function fmt(raw) {
  if (!raw) return '';
  const esc  = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const inline = s => s
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>');
  const lines = raw.split('\n');
  const out=[]; let inUl=false,inOl=false,para=[],inTable=false,tableRows=[];
  const flushP=()=>{ if(!para.length)return; const j=para.join(' ').trim(); if(j)out.push(`<p>${inline(esc(j))}</p>`); para=[]; };
  const closeL=()=>{ if(inUl){out.push('</ul>');inUl=false;} if(inOl){out.push('</ol>');inOl=false;} };
  const flushTable=()=>{
    if(!tableRows.length)return;
    const header=tableRows[0]; const dataRows=tableRows.filter(r=>r!==null).slice(1);
    let html='<table><thead><tr>';
    header.forEach(c=>{html+=`<th>${inline(esc(c.trim()))}</th>`;});
    html+='</tr></thead><tbody>';
    dataRows.forEach(row=>{html+='<tr>';row.forEach(c=>{html+=`<td>${inline(esc(c.trim()))}</td>`;});html+='</tr>';});
    html+='</tbody></table>'; out.push(html); tableRows=[]; inTable=false;
  };
  for(const raw_line of lines) {
    const line=raw_line.trimEnd(); const t=line.trim();
    if(t.startsWith('|')&&t.endsWith('|')){
      flushP();closeL();
      const cells=t.slice(1,-1).split('|');
      const isSep=cells.every(c=>/^[-:| ]+$/.test(c));
      if(isSep&&inTable){tableRows.push(null);continue;}
      if(!inTable)inTable=true;
      tableRows.push(cells); continue;
    } else if(inTable){tableRows=tableRows.filter(r=>r!==null);flushTable();}
    if(!t){flushP();closeL();continue;}
    if(/^[-*_]{3,}$/.test(t)){flushP();closeL();out.push('<hr>');continue;}
    const h4m=t.match(/^####\s+(.+)/); if(h4m){flushP();closeL();out.push(`<h4>${inline(esc(h4m[1]))}</h4>`);continue;}
    const h3m=t.match(/^###\s+(.+)/);  if(h3m){flushP();closeL();out.push(`<h3>${inline(esc(h3m[1]))}</h3>`);continue;}
    const h2m=t.match(/^##\s+(.+)/);   if(h2m){flushP();closeL();out.push(`<h2>${inline(esc(h2m[1]))}</h2>`);continue;}
    const bqm=t.match(/^>\s*(.*)/);    if(bqm){flushP();closeL();out.push(`<blockquote>${inline(esc(bqm[1]))}</blockquote>`);continue;}
    const olm=t.match(/^(\d+)[.)]\s+(.+)/); if(olm){flushP();if(!inOl){closeL();out.push('<ol>');inOl=true;}out.push(`<li>${inline(esc(olm[2]))}</li>`);continue;}
    const ulm=t.match(/^[-*•]\s+(.+)/); if(ulm){flushP();if(!inUl){closeL();out.push('<ul>');inUl=true;}out.push(`<li>${inline(esc(ulm[1]))}</li>`);continue;}
    closeL(); para.push(t);
  }
  if(inTable){tableRows=tableRows.filter(r=>r!==null);flushTable();}
  flushP();closeL();
  return out.join('\n');
}

/* ── HIGHLIGHT ── */
export function hl(text, q) {
  if(!q||!text) return text||'';
  const safe=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return safe.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi'),'<mark class="hl">$1</mark>');
}

/* ── NORMALIZE EJE ── */
export function normalizeEje(e) {
  if(!e) return e;
  const map={'economico':'Economía','económico':'Economía','economía':'Economía','economia':'Economía',
    'económico y empresarial':'Economía','psicologia':'Psicología','psicología':'Psicología',
    'filosofia':'Filosofía','filosofía':'Filosofía','neurociencia':'Neurociencia',
    'desarrollo personal':'Desarrollo Personal','individual':'Individual','civilizacional':'Civilizacional',
    'epistemológico':'Epistemológico','epistemologico':'Epistemológico',
    'neurológico-biológico':'Neurológico-Biológico','financiero':'Financiero',
    'historia':'Historia','ciencias':'Ciencias'};
  return map[e.toLowerCase()]||e;
}

/* ── EJE HELPERS ── */
export function ejeColor(e, config) {
  if(!e) return '#5c5650';
  for(const[p,cfg] of Object.entries(config)){
    if(e===p || (cfg.sub && cfg.sub[e] !== undefined)) return cfg.color;
  }
  return '#5c5650';
}
export function ejeClass(e) { return 'eje-'+(e||'').replace(/[^a-zA-Z0-9]/g,'_'); }
export function getEjePrincipal(l) { return l.eje_principal||l.eje||''; }
export function getSubEje(l) { return l.sub_eje||l.eje||''; }

/* ── NL2BR ── */
export function nl2br(s) { return (s||'').split('\n').join('<br>'); }

/* ── CALC STREAK ── */
export function calcStreak(prog, hoy) {
  const toLocal = d => { const o = new Date(d); return `${o.getFullYear()}-${String(o.getMonth()+1).padStart(2,'0')}-${String(o.getDate()).padStart(2,'0')}`; };
  const dias=[...new Set(prog.map(p=>p.fecha?toLocal(p.fecha):null).filter(Boolean))].sort();
  if(!dias.length) return 0;
  if (!hoy) hoy = toLocal(new Date());
  let streak=0, cur=hoy;
  for(let i=dias.length-1;i>=0;i--) {
    if(dias[i]===cur){streak++;const d=new Date(cur+'T12:00:00');d.setDate(d.getDate()-1);cur=toLocal(d);}
    else if(dias[i]<cur) break;
  }
  return streak;
}

/* ── DIFFICULTY LABEL ── */
export function difLabel(d) {
  const map={1:'Básica',2:'Media',3:'Difícil'};
  const cls={1:'d1',2:'d2',3:'d3'};
  return `<span class="preg-dif ${cls[d]||'d1'}">${map[d]||'Básica'}</span>`;
}

/* ── QUIZ: POOL FILTERING ── */
export function tcGetPool(preg, libros, tcLibroId, tcEjeActivo) {
  let pool = tcLibroId ? preg.filter(p => p.libro_id === tcLibroId) : [...preg];
  if (tcEjeActivo) pool = pool.filter(p => {
    const l = libros.find(x => x.id === p.libro_id);
    return l?.eje === tcEjeActivo;
  });
  return pool;
}

/* ── QUIZ: LANZAR TEST (lógica de ordenamiento) ── */
export function buildTestQueue(pool, prog, n) {
  const mal = new Set(
    prog.filter(p => p.tipo === 'pregunta' && p.resultado === 'incorrecta').map(p => p.item_id)
  );
  const malas = pool.filter(p => mal.has(p.id));
  const resto = pool.filter(p => !mal.has(p.id));
  const limit = n === 999 ? pool.length : n;
  return [...malas, ...resto].slice(0, Math.min(limit, pool.length));
}

/* ── QUIZ: SCORING ── */
export function responderLogic(pregunta, idx) {
  if (idx < 0 || idx >= (pregunta.opciones || []).length) return null;
  const ok = idx === pregunta.correcta;
  return { ok, resultado: ok ? 'correcta' : 'incorrecta' };
}

/* ── QUIZ: RESULTADOS FINALES ── */
export function calcResultados(testResp) {
  const total = testResp.length;
  const ok = testResp.filter(r => r.ok).length;
  const pct = total ? Math.round(ok / total * 100) : 0;
  const fallos = testResp.filter(r => !r.ok);
  return { total, ok, pct, fallos };
}

/* ── FILTRAR LIBROS ── */
export function filtrarLibrosActivos(libros, ejeActivo, subEjeActivo, searchQ) {
  let f = libros;
  if (ejeActivo) f = f.filter(l => getEjePrincipal(l) === ejeActivo);
  if (subEjeActivo) f = f.filter(l => getSubEje(l) === subEjeActivo);
  if (searchQ) f = f.filter(l =>
    l.titulo?.toLowerCase().includes(searchQ) ||
    l.autor?.toLowerCase().includes(searchQ) ||
    getEjePrincipal(l)?.toLowerCase().includes(searchQ)
  );
  return f;
}

/* ── LOCAL STORAGE WRAPPER ── */
export function createLS(storage) {
  return {
    get: (k, def) => { try { return JSON.parse(storage.getItem(k)) ?? def; } catch { return def; } },
    set: (k, v) => storage.setItem(k, JSON.stringify(v)),
  };
}

/* ── FAV TOGGLE (lógica pura) ── */
export function toggleFavLogic(favCache, tipo, itemId) {
  const arr = favCache[tipo];
  const on = arr.includes(itemId);
  if (on) {
    return { newCache: { ...favCache, [tipo]: arr.filter(x => x !== itemId) }, added: false };
  } else {
    return { newCache: { ...favCache, [tipo]: [...arr, itemId] }, added: true };
  }
}

/* ── PERSISTENCIA: cargar favoritos con fallback ── */
export async function loadFavoritosFromDB(sbFetch, ls, keys) {
  try {
    const rows = await sbFetch('favoritos_usuario?select=tipo,item_id&usuario_id=eq.default');
    const cache = { libro: [], leccion: [], cita: [] };
    (rows || []).forEach(r => { if (cache[r.tipo]) cache[r.tipo].push(r.item_id); });
    return cache;
  } catch {
    return {
      libro: ls.get(keys.lib, []),
      leccion: ls.get(keys.lec, []),
      cita: ls.get(keys.quo, []),
    };
  }
}

/* ── PERSISTENCIA: cargar notas con fallback ── */
export async function loadNotasFromDB(sbFetch, ls, notasKey) {
  try {
    const rows = await sbFetch('notas?select=leccion_id,texto&usuario_id=eq.default');
    const cache = {};
    (rows || []).forEach(r => { cache[r.leccion_id] = r.texto; });
    return cache;
  } catch {
    return ls.get(notasKey, {});
  }
}

/* ── PERSISTENCIA: guardar nota con backup localStorage ── */
export async function saveNota(sbFetch, ls, notasKey, notasCache, id, txt) {
  notasCache[id] = txt;
  const n = ls.get(notasKey, {}); n[id] = txt; ls.set(notasKey, n);
  try {
    await sbFetch('notas', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify({ usuario_id: 'default', leccion_id: id, texto: txt, updated_at: new Date().toISOString() })
    });
    return true;
  } catch {
    return false;
  }
}
