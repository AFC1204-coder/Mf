/* ═══════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════
   IMAGE ERROR HANDLERS (Evita Syntax Errors de SVG en atributos)
═══════════════════════════════════════════ */
window.handleCoverError = function(imgEl, ejeStr) {
  if (imgEl && imgEl.parentElement) {
    imgEl.parentElement.innerHTML = makePlaceholder(ejeIcon(ejeStr), ejeStr || '');
  }
};
window.handleUltimosError = function(imgEl, ejeStr) {
  if (imgEl) {
    imgEl.outerHTML = '<span>' + ejeIcon(ejeStr) + '</span>';
  }
};

const esc=s=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const SB_URL = 'https://aduizdiiacrvpoavjmab.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdWl6ZGlpYWNydnBvYXZqbWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTg5MDEsImV4cCI6MjA4NzE3NDkwMX0.US2sEhlSBJbcwg93txuL-9AdPKo2LLmdVX5dur7i5GQ';

async function sb(path, opts={}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers:{'apikey':SB_KEY,'Authorization':`Bearer ${SB_KEY}`,'Content-Type':'application/json','Prefer':'return=representation',...opts.headers},
    ...opts
  });
  if (!r.ok) { const e = await r.text(); throw new Error(e); }
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
async function sbAll(path, opts={}) {
  const PAGE=1000; let all=[], offset=0;
  while(true){
    const sep=path.includes('?')?'&':'?';
    const r=await fetch(`${SB_URL}/rest/v1/${path}${sep}limit=${PAGE}&offset=${offset}`,{
      headers:{'apikey':SB_KEY,'Authorization':`Bearer ${SB_KEY}`,'Content-Type':'application/json','Prefer':'return=representation',...opts.headers},
      ...opts
    });
    if(!r.ok){const e=await r.text();throw new Error(e);}
    const t=await r.text(); const batch=t?JSON.parse(t):[];
    all=all.concat(batch);
    if(batch.length<PAGE)break;
    offset+=PAGE;
  }
  return all;
}

/* ═══════════════════════════════════════════
   LOADER
═══════════════════════════════════════════ */
const MSGS = ['cargando biblioteca...','preparando el corpus...','organizando el conocimiento...','sincronizando datos...','casi listo...'];
let msgI = 0;
const msgTimer = setInterval(() => {
  const el = document.getElementById('loader-msg');
  if (el) el.textContent = MSGS[msgI++ % MSGS.length];
}, 950);

/* ═══════════════════════════════════════════
   STATE
═══════════════════════════════════════════ */
let libros=[], lecs=[], preg=[], prog=[];
let libroActual=null, lecActual=null;
let ejeActivo=null, subEjeActivo=null, searchQ='', lecFilter='all';
let testPregs=[], testIdx=0, testResp=[], testCorr=0, testErr=0;
let repasoLecs=[], repasoIdx=0;
const PAGE_SIZE=24;
let paginaActual=1;

/* ═══════════════════════════════════════════
   ADMIN MODE
═══════════════════════════════════════════ */
let adminMode = false;
let adminClickCount = 0;
let adminClickTimer = null;
const ADMIN_HASH = '3759a11a266d5d0c0230f063336a42145660df50837a885d2d7e6df034383a28';
async function checkAdminPwd(pwd) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd));
  const hex = [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  return hex === ADMIN_HASH;
}

function initAdminTrigger() {
  const el = document.getElementById('admin-trigger');
  if (!el) return;
  el.addEventListener('click', async function(e) {
    e.stopPropagation();
    adminClickCount++;
    clearTimeout(adminClickTimer);
    adminClickTimer = setTimeout(() => { adminClickCount = 0; }, 600);
    if (adminClickCount >= 3) {
      adminClickCount = 0;
      clearTimeout(adminClickTimer);
      if (adminMode) {
        adminMode = false;
        el.style.background = '';
        reloadLibros();
        toast('Modo admin desactivado');
      } else {
        const pwd = prompt('');
        if (pwd && await checkAdminPwd(pwd)) {
          adminMode = true;
          el.style.background = 'var(--accent2)';
          reloadLibros();
          toast('\u2605 Modo admin activado');
        }
      }
    }
  });
}

async function reloadLibros() {
  try {
    const query = adminMode
      ? 'libros?select=*&order=fecha_creacion.asc'
      : 'libros?select=*&publico=eq.true&order=fecha_creacion.asc';
    libros = await sb(query);
    libros = libros.map(l => ({...l, eje: normalizeEje(l.eje)}));
    renderStats(); renderEjes(); renderLibros(); renderContinua(); renderUltimosLibros();
  } catch(e) { toast('Error recargando: ' + e.message); }
}

/* ═══════════════════════════════════════════
   LOCAL STORAGE (legacy fallback)
═══════════════════════════════════════════ */
const LS = {
  get:(k,def)=>{ try{return JSON.parse(localStorage.getItem(k))??def;}catch{return def;} },
  set:(k,v)=>localStorage.setItem(k,JSON.stringify(v)),
};
const FAV_LIB='scs2_fav_lib', FAV_LEC='scs2_fav_lec', FAV_QUO='scs2_fav_quo';
const NOTAS_K='scs2_notas', ULTIMA_K='scs2_ultima_lec';

/* ═══════════════════════════════════════════
   FAVORITOS — Supabase-backed
═══════════════════════════════════════════ */
let favCache = { libro: [], leccion: [], cita: [] };
let notasCache = {};
const USUARIO_ID = 'default';

async function loadFavoritosFromDB() {
  try {
    const rows = await sb(`favoritos_usuario?select=tipo,item_id&usuario_id=eq.${USUARIO_ID}`);
    favCache = { libro: [], leccion: [], cita: [] };
    (rows||[]).forEach(r => {
      if (favCache[r.tipo]) favCache[r.tipo].push(r.item_id);
    });
  } catch(e) {
    console.warn('Fallback to localStorage for favs:', e.message);
    favCache.libro = LS.get(FAV_LIB, []);
    favCache.leccion = LS.get(FAV_LEC, []);
    favCache.cita = LS.get(FAV_QUO, []);
  }
}

async function loadNotasFromDB() {
  try {
    const rows = await sb(`notas?select=leccion_id,texto&usuario_id=eq.${USUARIO_ID}`);
    notasCache = {};
    (rows||[]).forEach(r => { notasCache[r.leccion_id] = r.texto; });
  } catch(e) {
    console.warn('Fallback to localStorage for notas:', e.message);
    notasCache = LS.get(NOTAS_K, {});
  }
}

const favLibros  = () => favCache.libro;
const favLecs    = () => favCache.leccion;
const favQuotes  = () => favCache.cita;
const getNotas   = id => notasCache[id] || '';

async function saveNota(id, txt) {
  notasCache[id] = txt;
  // Also persist to localStorage as backup
  const n = LS.get(NOTAS_K, {}); n[id] = txt; LS.set(NOTAS_K, n);
  try {
    await sb('notas', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify({ usuario_id: USUARIO_ID, leccion_id: id, texto: txt, updated_at: new Date().toISOString() })
    });
  } catch(e) { console.warn('Nota save to DB failed:', e.message); }
}

async function toggleFavDB(tipo, itemId) {
  const arr = favCache[tipo];
  const on = arr.includes(itemId);
  if (on) {
    favCache[tipo] = arr.filter(x => x !== itemId);
    try { await sb(`favoritos_usuario?usuario_id=eq.${USUARIO_ID}&tipo=eq.${tipo}&item_id=eq.${itemId}`, { method: 'DELETE' }); } catch(e) { console.warn(e); }
  } else {
    favCache[tipo].push(itemId);
    try { await sb('favoritos_usuario', { method: 'POST', body: JSON.stringify({ usuario_id: USUARIO_ID, tipo, item_id: itemId }) }); } catch(e) { console.warn(e); }
  }
  // Sync to localStorage backup
  LS.set(FAV_LIB, favCache.libro);
  LS.set(FAV_LEC, favCache.leccion);
  LS.set(FAV_QUO, favCache.cita);
  return !on;
}

function toggleFavLib(id, btn) {
  toggleFavDB('libro', id).then(on => {
    btn.textContent = on ? '★' : '☆';
    btn.classList.toggle('on', on);
    toast(on ? '★ Guardado en favoritos' : 'Eliminado de favoritos');
  });
}
function toggleFavLec(id, btn) {
  toggleFavDB('leccion', id).then(on => {
    btn.textContent = on ? '★' : '☆';
    btn.classList.toggle('on', on);
    toast(on ? '★ Lección guardada' : 'Lección eliminada');
  });
}
function toggleFavQuote(key, btn) {
  toggleFavDB('cita', key).then(on => {
    btn.textContent = on ? '★' : '☆';
    btn.classList.toggle('on', on);
  });
}

async function migrateLocalStorageToDB() {
  // One-time migration: move localStorage favorites/notas to Supabase
  const migrated = LS.get('scs2_migrated_v1', false);
  if (migrated) return;
  try {
    // Migrate favoritos
    const oldLibs = LS.get(FAV_LIB, []);
    const oldLecs = LS.get(FAV_LEC, []);
    const oldQuo = LS.get(FAV_QUO, []);
    const favRows = [];
    oldLibs.forEach(id => favRows.push({ usuario_id: USUARIO_ID, tipo: 'libro', item_id: id }));
    oldLecs.forEach(id => favRows.push({ usuario_id: USUARIO_ID, tipo: 'leccion', item_id: id }));
    oldQuo.forEach(id => favRows.push({ usuario_id: USUARIO_ID, tipo: 'cita', item_id: id }));
    if (favRows.length) {
      await sb('favoritos_usuario', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation,resolution=ignore-duplicates' },
        body: JSON.stringify(favRows)
      });
    }
    // Migrate notas
    const oldNotas = LS.get(NOTAS_K, {});
    const notaRows = Object.entries(oldNotas).filter(([,v]) => v).map(([id, texto]) => ({
      usuario_id: USUARIO_ID, leccion_id: id, texto, updated_at: new Date().toISOString()
    }));
    if (notaRows.length) {
      for (const row of notaRows) {
        try {
          await sb('notas', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation,resolution=merge-duplicates' },
            body: JSON.stringify(row)
          });
        } catch(e) { console.warn('Nota migration failed for', row.leccion_id, e); }
      }
    }
    LS.set('scs2_migrated_v1', true);
    console.log('Migration complete:', favRows.length, 'favs,', notaRows.length, 'notas');
  } catch(e) { console.warn('Migration failed, will retry next load:', e.message); }
}

const setUltima  = (lecId,libId) => LS.set(ULTIMA_K,{lecId,libId,ts:Date.now()});
const getUltima  = () => LS.get(ULTIMA_K,null);

/* ═══════════════════════════════════════════
   RACHA
═══════════════════════════════════════════ */
function calcStreak() {
  const toLocal=d=>{ const o=new Date(d); return `${o.getFullYear()}-${String(o.getMonth()+1).padStart(2,'0')}-${String(o.getDate()).padStart(2,'0')}`; };
  const dias=[...new Set(prog.map(p=>p.fecha?toLocal(p.fecha):null).filter(Boolean))].sort();
  if(!dias.length) return 0;
  const hoy=toLocal(new Date());
  let streak=0, cur=hoy;
  for(let i=dias.length-1;i>=0;i--) {
    if(dias[i]===cur){streak++;const d=new Date(cur+'T12:00:00');d.setDate(d.getDate()-1);cur=toLocal(d);}
    else if(dias[i]<cur) break;
  }
  return streak;
}

/* ═══════════════════════════════════════════
   PORTADAS
═══════════════════════════════════════════ */
const coverCache = {};
async function getCover(autor, titulo, libroId) {
  const key = `${autor}___${titulo}`;
  if (coverCache[key] !== undefined) return coverCache[key];

  let url = null;

  // 1. Intentar OpenLibrary
  try {
    const q = encodeURIComponent(`${titulo} ${autor}`);
    const r = await fetch(`https://openlibrary.org/search.json?q=${q}&limit=1&fields=cover_i`);
    const d = await r.json();
    const coverId = d?.docs?.[0]?.cover_i;
    if (coverId) url = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`;
  } catch {}

  // 2. Fallback: Google Books
  if (!url) {
    try {
      const q = encodeURIComponent(`${titulo} ${autor}`);
      const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1&fields=items(volumeInfo/imageLinks)`);
      const d = await r.json();
      const thumb = d?.items?.[0]?.volumeInfo?.imageLinks;
      if (thumb) url = (thumb.thumbnail || thumb.smallThumbnail || '').replace('http://', 'https://');
      if (url) url = url.replace('&edge=curl', '').replace('zoom=1', 'zoom=2');
    } catch {}
  }

  coverCache[key] = url;

  // 3. Persistir en Supabase para no volver a buscar
  if (url && libroId) {
    try {
      await sb(`libros?id=eq.${libroId}`, {
        method: 'PATCH',
        body: JSON.stringify({ portada_url: url })
      });
    } catch {}
  }

  return url;
}

/* ═══════════════════════════════════════════
   FORMAT TEXT — markdown mejorado
═══════════════════════════════════════════ */
function fmt(raw) {
  if (!raw) return '';
  if (/<table[\s>]/i.test(raw)) {
    const tables = [];
    const masked = raw.replace(/<table[\s\S]*?<\/table>/gi, m => {
      tables.push(m
        .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, ''));
      return `\n\n@@TBL${tables.length - 1}@@\n\n`;
    });
    let html = fmt(masked);
    tables.forEach((t, i) => {
      html = html.replace(new RegExp(`<p>\\s*@@TBL${i}@@\\s*</p>`), t)
                 .replace(`@@TBL${i}@@`, t);
    });
    return html;
  }
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

/* ═══════════════════════════════════════════
   EJE CONFIG
═══════════════════════════════════════════ */
const EJES_CONFIG={
  'Neurociencia y Biología':{icon:'<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6"/><path d="M10 3v13.5l-4 5.5h12l-4-5.5V3"/><path d="M6 18h12"/></svg>',color:'#1abc9c',sub:{'Neurociencia':null,'Biología y Longevidad':null,'Neurológico-Biológico':null}},
  'Psicología y Conducta':{icon:'<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>',color:'#9b59b6',sub:{'Cognitiva':null,'Social':null,'Interpersonal':null,'Influencia':null,'Psicología Cognitiva':null,'Psicología Interpersonal':null,'Psicología Relacional':null,'Psicología Social':null,'Influencia y Relaciones':null}},
  'Pensamiento y Civilización':{icon:'<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M3 7h18"/><path d="m3 7 3 9a4 4 0 0 0 8 0V7"/><path d="m21 7-3 9a4 4 0 0 1-8 0V7"/></svg>',color:'#5dade2',sub:{'Epistemología':null,'Filosofía':null,'Historia':null,'Civilizacional':null,'Epistemológico':null,'Historia y Civilización':null}},
  'Economía y Mercados':{icon:'<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',color:'#c9a84c',sub:{'Economía':null}},
  'Desarrollo Humano':{icon:'<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>',color:'#e67e22',sub:{'Mentalidad':null,'Crecimiento Personal':null,'Individual':null}}
};
function ejeIcon(e){
  if(!e)return'<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
  for(const[p,cfg]of Object.entries(EJES_CONFIG)){if(e===p)return cfg.icon;if(cfg.sub && cfg.sub[e] !== undefined)return cfg.sub[e] || cfg.icon;}
  return'<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
}
function ejeColor(e){
  if(!e)return'#5c5650';
  for(const[p,cfg]of Object.entries(EJES_CONFIG)){if(e===p||(cfg.sub && cfg.sub[e] !== undefined))return cfg.color;}
  return'#5c5650';
}
function ejeClass(e){return'eje-'+(e||'').replace(/[^a-zA-Z0-9]/g,'_');}
function getEjePrincipal(l){return l.eje_principal||l.eje||'';}
function getSubEje(l){return l.sub_eje||l.eje||'';}
function normalizeEje(e){
  if(!e)return e;
  const map={'economico':'Economía','económico':'Economía','economía':'Economía','economia':'Economía',
    'económico y empresarial':'Economía','psicologia':'Psicología','psicología':'Psicología',
    'filosofia':'Filosofía','filosofía':'Filosofía','neurociencia':'Neurociencia',
    'desarrollo personal':'Desarrollo Personal','individual':'Individual','civilizacional':'Civilizacional',
    'epistemológico':'Epistemológico','epistemologico':'Epistemológico',
    'neurológico-biológico':'Neurológico-Biológico','financiero':'Financiero',
    'historia':'Historia','ciencias':'Ciencias'};
  return map[e.toLowerCase()]||e;
}

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
async function init() {
  try {
    [libros, lecs, preg, prog] = await Promise.all([
      sb('libros?select=*&publico=eq.true&order=fecha_creacion.asc'),
      sbAll('lecciones?select=*&activa=eq.true&order=orden.asc'),
      sbAll('preguntas?select=*&activa=eq.true'),
      sbAll('progreso?select=*&order=fecha.asc')
    ]);
    libros = libros.map(l=>({...l, eje:normalizeEje(l.eje)}));
    // Load favoritos and notas from Supabase
    await Promise.all([loadFavoritosFromDB(), loadNotasFromDB()]);
    // One-time migration from localStorage
    migrateLocalStorageToDB();
    clearInterval(msgTimer);
    setTimeout(()=>{
      document.getElementById('loader-screen').classList.add('hidden');
      setTimeout(()=>document.getElementById('loader-screen').style.display='none',500);
    },300);
    renderStats(); renderEjes(); renderLibros(); renderAtril(); renderUltimosLibros(); renderEsquemas(); initAdminTrigger();
    // Restaurar estado desde URL hash (para enlaces compartidos y marcadores)
    restoreFromURL();
  } catch(e) {
    clearInterval(msgTimer);
    document.getElementById('loader-msg').textContent = 'Error al cargar: '+(e.message||'desconocido');
  }
}

/* ═══════════════════════════════════════════
   STATS
═══════════════════════════════════════════ */
function completadasSet(){
  return new Set(prog.filter(p=>p.tipo==='leccion'&&p.resultado==='correcta').map(p=>p.item_id));
}
function renderStats(){
  const comp=completadasSet();
  const pct=lecs.length?Math.round(comp.size/lecs.length*100):0;
  animStat('s-libros',libros.length);
  animStat('s-comp',comp.size);
  animStat('s-pct',pct+'%');
  animStat('s-racha',calcStreak());
  document.getElementById('home-sub').textContent=`${libros.length} libros · ${lecs.length} lecciones · ${preg.length} preguntas`;
}
function animStat(id,val){
  const el=document.getElementById(id);
  const str=String(val);
  if(el.textContent!=='—'&&el.textContent!==str){
    el.style.animation='none';el.offsetHeight;
    el.style.animation='numPulse 0.4s ease';
  }
  el.textContent=str;
}

const ULTIMOS_K='scs2_ultimos';
function addUltimo(libroId){
  let arr=LS.get(ULTIMOS_K,[]);
  arr=arr.filter(id=>id!==libroId);
  arr.unshift(libroId);
  LS.set(ULTIMOS_K,arr.slice(0,6));
}
function renderUltimosLibros(){
  const arr=LS.get(ULTIMOS_K,[]);
  const sec=document.getElementById('ultimos-libros-section');
  const cont=document.getElementById('ultimos-libros-cont');
  const validos=arr.map(id=>libros.find(l=>l.id===id)).filter(Boolean);
  if(!validos.length){sec.style.display='none';return;}
  sec.style.display='block';
  const comp=completadasSet();
  cont.innerHTML=validos.map(l=>{
    const lecsL=lecs.filter(x=>x.libro_id===l.id);
    const done=lecsL.filter(x=>comp.has(x.id)).length;
    const pct=lecsL.length?Math.round(done/lecsL.length*100):0;
    const isDone = pct === 100 && lecsL.length > 0;
    
    // We let CSS style the span as a beautiful dark placeholder if no image exists
    const subE = getEjePrincipal(l) || '';
    const coverEl=l.portada_url
      ?`<img src="${l.portada_url}" alt="${esc(l.titulo)}" data-eje="${esc(subE)}" onload="if(this.naturalWidth<=1) handleUltimosError(this, this.dataset.eje)" onerror="handleUltimosError(this, this.dataset.eje)">`
      :`<span>${ejeIcon(subE)}</span>`;
      
    // Netflix-style horizontal poster
    return `<div class="rec-poster" onclick="verLibro('${l.id}')">
      <div class="rec-cover-wrap" id="ultcover-${l.id}">
        ${coverEl}
        <div class="rec-prog-container">
          <div class="rec-prog-fill" style="width:${pct}%; background:${isDone ? 'var(--success)' : 'var(--accent)'}; box-shadow: 0 0 8px ${isDone ? 'var(--success)' : 'var(--accent)'}"></div>
        </div>
      </div>
      <div class="rec-title">${esc(l.titulo)}</div>
    </div>`;
  }).join('');
  // Buscar portadas en OpenLibrary para los que no tienen
  validos.filter(l=>!l.portada_url).forEach(l=>{
    getCover(l.autor,l.titulo,l.id).then(url=>{
      if(!url)return;
      l.portada_url=url;
      const wrap=document.getElementById(`ultcover-${l.id}`);
      if(!wrap)return;
      const subE=getEjePrincipal(l)||'';
      const prog=wrap.querySelector('.rec-prog-container');
      const progHTML=prog?prog.outerHTML:'';
      wrap.innerHTML=`<img src="${url}" alt="${esc(l.titulo)}" data-eje="${esc(subE)}" onload="if(this.naturalWidth<=1) handleUltimosError(this, this.dataset.eje)" onerror="handleUltimosError(this, this.dataset.eje)">${progHTML}`;
    });
  });
}

/* ═══════════════════════════════════════════
   ATRIL — sesión de noche
═══════════════════════════════════════════ */
const NOCHE_K = 'scs2_noche';
const HILO_K = 'scs2_hilo';
let srsLimiteSesion = 20;
let srsSkipDash = false;

const Ambiente = (() => {
  const K = 'scs2_ambiente';
  let ctx = null, master = null, timer = null, on = false;

  function wanted(){ return LS.get(K, false) === true; }

  function ensure(){
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 640;
    lp.Q.value = 0.65;
    master.connect(lp);
    lp.connect(ctx.destination);

    const dur = 2;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 0.35;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const ng = ctx.createGain(); ng.gain.value = 0.03;
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 240;
    noise.connect(nf); nf.connect(ng); ng.connect(master);
    noise.start();

    [[82.41, 0.032], [123.47, 0.022], [164.81, 0.016]].forEach(([f, g]) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og); og.connect(master);
      o.start();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.025 + Math.random() * 0.03;
      const lg = ctx.createGain(); lg.gain.value = 3.5;
      lfo.connect(lg); lg.connect(o.detune);
      lfo.start();
    });
  }

  function note(){
    if (!ctx || !on) return;
    const scale = [196, 220, 233.08, 261.63, 293.66, 329.63];
    const f = scale[Math.floor(Math.random() * scale.length)];
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.035, t + 2.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 9);
    const f2 = ctx.createBiquadFilter();
    f2.type = 'lowpass';
    f2.frequency.value = 820;
    o.connect(f2); f2.connect(g); g.connect(master);
    o.start();
    o.stop(t + 10);
  }

  function syncBtn(){
    document.querySelectorAll('.atril-sound').forEach(b => {
      b.classList.toggle('on', on);
      b.textContent = on ? 'Ambiente · on' : 'Ambiente';
    });
  }

  function start(){
    ensure();
    if (!ctx) return;
    ctx.resume();
    on = true;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.linearRampToValueAtTime(1, t + 2.8);
    LS.set(K, true);
    if (timer) clearInterval(timer);
    timer = setInterval(note, 12000);
    setTimeout(note, 1800);
    syncBtn();
  }

  function stop(){
    on = false;
    if (ctx && master) {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.linearRampToValueAtTime(0, t + 1.4);
    }
    if (timer) { clearInterval(timer); timer = null; }
    LS.set(K, false);
    syncBtn();
  }

  function toggle(){ on ? stop() : start(); }

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (on) ctx.resume();
  });

  return { toggle, start, stop, wanted, syncBtn, get on(){ return on; } };
})();

const Lectura = (() => {
  const K = 'scs2_ereader';
  function on(){ return LS.get(K, true) !== false; }
  function syncBtn(){
    document.querySelectorAll('.lec-kindle').forEach(b => {
      b.classList.toggle('on', on());
      b.textContent = on() ? 'Kindle · on' : 'Kindle';
    });
  }
  function apply(view){
    const reading = view
      ? (view === 'leccion' || view === 'cuaderno')
      : !!(document.getElementById('view-leccion')?.classList.contains('active')
        || document.getElementById('view-cuaderno')?.classList.contains('active'));
    document.body.classList.toggle('kindle', on() && reading);
    const paper = on() && reading;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper ? '#efe6d0' : '#080808');
    document.documentElement.style.colorScheme = paper ? 'light' : 'dark';
    syncBtn();
  }
  function toggle(){
    LS.set(K, !on());
    const view = document.getElementById('view-cuaderno')?.classList.contains('active') ? 'cuaderno'
      : document.getElementById('view-leccion')?.classList.contains('active') ? 'leccion' : null;
    apply(view);
  }
  return { on, apply, toggle, syncBtn };
})();

function hoyISO(){
  const o = new Date();
  return `${o.getFullYear()}-${String(o.getMonth()+1).padStart(2,'0')}-${String(o.getDate()).padStart(2,'0')}`;
}
function lecsDeLibro(libId){
  return lecs.filter(l=>l.libro_id===libId).sort((a,b)=>(a.orden||0)-(b.orden||0));
}
function isNocheCerrada(){
  const n = LS.get(NOCHE_K, null);
  return !!(n && n.date === hoyISO() && n.closed);
}
function setNocheCerrada(lecId){
  LS.set(NOCHE_K, { date: hoyISO(), lecId: lecId || null, closed: true });
}
function pickNocheLeccion(){
  const comp = completadasSet();
  const ultima = getUltima();
  if (ultima) {
    const lec = lecs.find(l=>l.id===ultima.lecId);
    if (lec && !comp.has(lec.id)) return lec;
    if (lec) {
      const next = lecsDeLibro(lec.libro_id).find(l => !comp.has(l.id));
      if (next) return next;
    }
  }
  const ordered = [...lecs].sort((a,b)=>(a.orden||0)-(b.orden||0));
  return ordered.find(l=>!comp.has(l.id)) || null;
}
function excerptNoche(cuerpo){
  const t = (cuerpo||'').replace(/[#>*_`]/g,'').replace(/\s+/g,' ').trim();
  if (!t) return 'Esta noche cabe una lección. El resto espera.';
  if (t.length <= 240) return t;
  return t.slice(0, 240).replace(/\s+\S*$/, '') + '.';
}
function nochesEsteMes(){
  const y = new Date().getFullYear(), m = new Date().getMonth();
  const days = new Set();
  prog.forEach(p=>{
    if (!p.fecha) return;
    const o = new Date(p.fecha);
    if (o.getFullYear()===y && o.getMonth()===m) {
      days.add(`${o.getFullYear()}-${String(o.getMonth()+1).padStart(2,'0')}-${String(o.getDate()).padStart(2,'0')}`);
    }
  });
  if (isNocheCerrada()) days.add(hoyISO());
  return days.size;
}
function lampsHtml(n){
  const lit = Math.min(7, Math.max(0, n));
  let h = '';
  for (let i=0;i<7;i++) h += `<i class="${i<lit?'on':''}"></i>`;
  return h;
}
function ultimaFrase(raw){
  const t = (raw||'').replace(/[#>*_`]/g,'').replace(/\s+/g,' ').trim();
  if (!t) return '';
  const parts = t.split(/(?<=[.!?…])\s+/).filter(s => s.replace(/["«»""]/g,'').trim().length > 24);
  const s = (parts.pop() || t).trim();
  return s.length > 280 ? s.slice(0, 277).replace(/\s+\S*$/, '') + '…' : s;
}
function guardarHilo(fromLec, nextLec){
  if (!fromLec) return;
  const libro = libros.find(l => l.id === fromLec.libro_id);
  const frase = ultimaFrase(fromLec.autocorreccion || fromLec.cuerpo);
  if (!frase) return;
  LS.set(HILO_K, {
    frase,
    fromId: fromLec.id,
    nextId: (nextLec && nextLec.id) || fromLec.id,
    titulo: fromLec.titulo,
    libro: libro ? libro.titulo : '',
    autor: libro ? libro.autor : '',
  });
}
function getHilo(){ return LS.get(HILO_K, null); }
function clearHilo(){ try { localStorage.removeItem(HILO_K); } catch(e) {} }

function renderAtril(){
  const root = document.getElementById('atril');
  if (!root) return;
  const nNoches = nochesEsteMes();
  const top = `<div class="atril-top"><div>Mente fría · <strong>Noche</strong></div>
    <div class="atril-nights">${lampsHtml(nNoches)}<span>${nNoches} noche${nNoches===1?'':'s'}</span>
      <button type="button" class="atril-sound${Ambiente.on?' on':''}" onclick="event.preventDefault();Ambiente.toggle()">${Ambiente.on?'Ambiente · on':'Ambiente'}</button>
    </div></div>`;

  if (isNocheCerrada()) {
    const n = LS.get(NOCHE_K, {});
    const done = lecs.find(l=>l.id===n.lecId);
    const hilo = getHilo();
    const tomorrow = hilo?.frase
      ? esc(hilo.frase)
      : (pickNocheLeccion() ? esc(pickNocheLeccion().titulo) : 'El corpus está al día.');
    root.innerHTML = `${top}
      <p class="atril-kicker">La lámpara sigue encendida</p>
      <h2 class="atril-title closed">Hasta mañana.</h2>
      <p class="atril-meta">${done ? 'Marcado · '+esc(done.titulo) : 'Sesión de esta noche completa.'}</p>
      <p class="atril-excerpt">El marcador queda en una frase. Mañana abre aquí.</p>
      <p class="atril-tomorrow"><em>${tomorrow}</em></p>
      <div class="atril-stamp">Ex libris · ${hoyISO().slice(8)} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][+hoyISO().slice(5,7)-1]}</div>`;
    return;
  }

  const hilo = getHilo();
  if (hilo && hilo.frase) {
    root.innerHTML = `${top}
      <p class="atril-kicker">Anoche te quedaste aquí</p>
      <h2 class="atril-title hilo">${esc(hilo.frase)}</h2>
      <p class="atril-meta">${esc(hilo.libro)}${hilo.autor?' — '+esc(hilo.autor):''}${hilo.titulo?' · '+esc(hilo.titulo):''}</p>
      <div class="atril-actions">
        <button class="atril-open" onclick="continuarHilo()">Continúa</button>
        <button class="atril-ghost" onclick="otroVolumenAtril()">Otro volumen</button>
      </div>`;
    return;
  }

  const lec = pickNocheLeccion();
  if (!lec) {
    root.innerHTML = `${top}
      <p class="atril-kicker">Nada pendiente</p>
      <h2 class="atril-title closed">El atril está vacío.</h2>
      <p class="atril-meta">Todas las lecciones están marcadas.</p>`;
    return;
  }
  const libro = libros.find(l=>l.id===lec.libro_id);
  const body = excerptNoche(lec.cuerpo);
  const drop = esc(body.charAt(0));
  const rest = esc(body.slice(1));
  const ord = lec.orden ? `Lección ${lec.orden}` : 'Lección';
  const nLib = lecsDeLibro(lec.libro_id).length;
  root.innerHTML = `${top}
    <p class="atril-kicker">El atril está puesto · ~20 minutos</p>
    <h2 class="atril-title">${esc(lec.titulo)}</h2>
    <p class="atril-meta">${ord}${nLib?` de ${nLib}`:''} · <em>${esc(libro?libro.titulo:'')}</em>${libro?' — '+esc(libro.autor):''}</p>
    <p class="atril-excerpt"><span class="drop">${drop}</span>${rest}</p>
    <p class="atril-after">Después, si quieres: <b>5 tarjetas</b> del mismo hilo — no la cola entera.</p>
    <div class="atril-actions">
      <button class="atril-open" onclick="abrirAtril()">Abrir el libro</button>
      <button class="atril-ghost" onclick="otroVolumenAtril()">Otro volumen</button>
      <button class="atril-ghost" onclick="cincoTarjetasNoche()">Cinco tarjetas</button>
    </div>`;
}
function renderContinua(){ renderAtril(); }

function abrirAtril(){
  if (Ambiente.wanted()) Ambiente.start();
  const hilo = getHilo();
  if (hilo && hilo.nextId && lecs.find(l=>l.id===hilo.nextId)) {
    abrirCuaderno(hilo.nextId);
    return;
  }
  const lec = pickNocheLeccion();
  if (!lec) return;
  libroActual = libros.find(l=>l.id===lec.libro_id) || null;
  abrirCuaderno(lec.id);
}
function continuarHilo(){
  const hilo = getHilo();
  const id = hilo?.nextId;
  if (!id || !lecs.find(l=>l.id===id)) { clearHilo(); abrirAtril(); return; }
  if (Ambiente.wanted()) Ambiente.start();
  abrirCuaderno(id);
}
function otroVolumenAtril(){
  clearHilo();
  const cur = pickNocheLeccion();
  const comp = completadasSet();
  const pool = lecs.filter(l => !comp.has(l.id) && (!cur || l.libro_id !== cur.libro_id));
  const src = pool.length ? pool : lecs.filter(l => !comp.has(l.id));
  if (!src.length) { toast('Sin otro volumen pendiente'); return; }
  const l = src[Math.floor(Math.random()*src.length)];
  setUltima(l.id, l.libro_id);
  renderAtril();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function cincoTarjetasNoche(){
  srsLimiteSesion = 5;
  srsSkipDash = true;
  showView('repaso-srs');
  iniciarSesionSRS();
}

/* ═══════════════════════════════════════════
   CUADERNO NOCHE — snap de 3 actos, un libro
═══════════════════════════════════════════ */
function cuadPlain(s, max){
  const t = (s||'').replace(/[#>*_`]/g,'').replace(/\s+/g,' ').trim();
  if (!t) return '';
  if (max && t.length > max) return t.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return t;
}
function siguienteLeccionMismoLibro(id){
  const lec = lecs.find(l=>l.id===id);
  if (!lec) return null;
  const comp = completadasSet();
  const list = lecsDeLibro(lec.libro_id);
  const idx = list.findIndex(l=>l.id===id);
  return list.slice(idx+1).find(l=>!comp.has(l.id)) || list.find(l=>!comp.has(l.id) && l.id!==id) || null;
}
function primeraLecDeLibro(libroId){
  const comp = completadasSet();
  const list = lecsDeLibro(libroId);
  return list.find(l=>!comp.has(l.id)) || list[0] || null;
}
function vecinoLibro(dir){
  if (!libroActual || !libros.length) return null;
  const i = libros.findIndex(l=>l.id===libroActual.id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= libros.length) return null;
  return libros[j];
}
let cuadernoSwipeLock = false;
function irTomo(dir){
  if (cuadernoSwipeLock) return;
  const b = vecinoLibro(dir);
  if (!b) { toast(dir>0 ? 'Último tomo de la estantería' : 'Primer tomo'); return; }
  const lec = primeraLecDeLibro(b.id);
  if (!lec) { toast('Ese tomo no tiene lecciones'); return; }
  cuadernoSwipeLock = true;
  abrirCuaderno(lec.id);
  setTimeout(()=>{ cuadernoSwipeLock = false; }, 450);
}
function bindCuadernoGestos(root){
  let x0=0, y0=0;
  root.addEventListener('touchstart', e => {
    const t = e.changedTouches[0];
    x0 = t.clientX; y0 = t.clientY;
  }, {passive:true});
  root.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;
    if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    irTomo(dx < 0 ? 1 : -1);
  }, {passive:true});
  let acc = 0;
  root.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 10) { acc = 0; return; }
    e.preventDefault();
    acc += e.deltaX;
    if (Math.abs(acc) > 90) { irTomo(acc > 0 ? 1 : -1); acc = 0; }
  }, {passive:false});
}
function onCuadernoKeys(e){
  if (!document.body.classList.contains('noche')) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); irTomo(1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); irTomo(-1); }
}
document.addEventListener('keydown', onCuadernoKeys);
function abrirCuaderno(id){
  lecActual = lecs.find(l=>l.id===id);
  if (!lecActual) return;
  libroActual = libros.find(l=>l.id===lecActual.libro_id) || libroActual;
  setUltima(id, lecActual.libro_id);
  if (Ambiente.wanted()) Ambiente.start();
  renderCuaderno();
  showView('cuaderno');
  const root = document.getElementById('cuaderno-root');
  if (root) root.scrollTop = 0;
}
function salirCuaderno(){
  if (lecActual) guardarHilo(lecActual, lecActual);
  showView('home');
}
function folioDesdeCuaderno(){
  if (lecActual) verLeccion(lecActual.id);
}
function otraDelTomo(){
  const n = siguienteLeccionMismoLibro(lecActual?.id);
  if (!n) { toast('No hay otra pendiente en este tomo'); return; }
  abrirCuaderno(n.id);
}
async function cerrarNocheCuaderno(){
  if (lecActual) {
    const nxt = siguienteLeccionMismoLibro(lecActual.id);
    guardarHilo(lecActual, nxt);
    await marcarCompletada(lecActual.id);
  }
  showView('home');
}
function renderCuaderno(){
  const root = document.getElementById('cuaderno-root');
  if (!root || !lecActual) return;
  const libro = libros.find(l=>l.id===lecActual.libro_id);
  const meta = `${libro?esc(libro.titulo):''}${libro?' — '+esc(libro.autor):''}${lecActual.orden?' · Lección '+lecActual.orden:''}`;
  const tesis = cuadPlain(lecActual.cuerpo, 1100);
  const manana = lecActual.aplicacion_practica || lecActual.conexion_cruzada || '';
  const giro = lecActual.autocorreccion || '';
  const nxt = siguienteLeccionMismoLibro(lecActual.id);
  let n = 1;
  const acts = [];

  acts.push(`<section class="cuad-act tesis" data-i="${n++}">
    <p class="cuad-kicker">Acto I · el marco</p>
    <h2 class="cuad-title">${esc(lecActual.titulo)}</h2>
    <p class="cuad-meta">${meta}</p>
    ${tesis ? `<div class="cuad-body"><span class="drop">${esc(tesis.charAt(0))}</span>${esc(tesis.slice(1))}</div>` : ''}
    <p class="cuad-hint">↑ actos de esta lección · ← → otro tomo</p>
  </section>`);

  if (manana && manana.trim()) {
    acts.push(`<section class="cuad-act manana" data-i="${n++}">
      <p class="cuad-kicker">Acto II · mañana</p>
      <h2 class="cuad-title">Qué haces con esto</h2>
      <p class="cuad-meta">Una acción. No el libro entero.</p>
      <div class="cuad-body fmt">${fmt(manana)}</div>
      <p class="cuad-hint">Sigue · el giro</p>
    </section>`);
  }

  if (giro && giro.trim()) {
    acts.push(`<section class="cuad-act giro" data-i="${n++}">
      <p class="cuad-kicker">Acto III · el giro</p>
      <h2 class="cuad-title">Dónde se rompe el marco</h2>
      <p class="cuad-meta">La duda que el propio texto se hace.</p>
      <div class="cuad-body fmt">${fmt(giro)}</div>
      <p class="cuad-hint">Última página</p>
    </section>`);
  }

  acts.push(`<section class="cuad-act cierre" data-i="${n++}">
    <p class="cuad-kicker">La lámpara sigue encendida</p>
    <h2 class="cuad-title closed atril-title">Hasta mañana.</h2>
    <p class="cuad-meta">Esta sentada basta. El marcador queda aquí.</p>
    <div class="cuad-stamp">Ex libris · ${hoyISO().slice(8)} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][+hoyISO().slice(5,7)-1]}</div>
    <div class="cuad-actions">
      <button class="atril-open" onclick="cerrarNocheCuaderno()">Cerrar por hoy</button>
      ${nxt?`<button class="atril-ghost" onclick="otraDelTomo()">Otra de este tomo</button>`:''}
      <button class="atril-ghost" onclick="folioDesdeCuaderno()">Ver folio</button>
    </div>
  </section>`);

  const total = acts.length;
  const dots = Array.from({length:total}, (_,i)=>`<i class="${i===0?'on':''}"></i>`).join('');
  root.innerHTML = `
    <div class="cuad-bar">
      <button type="button" onclick="salirCuaderno()">Salir</button>
      <span>
        <button type="button" class="lec-kindle" onclick="Lectura.toggle()">Kindle</button>
        <button type="button" class="atril-sound${Ambiente.on?' on':''}" onclick="Ambiente.toggle()">${Ambiente.on?'Ambiente · on':'Ambiente'}</button>
      </span>
    </div>
    <div class="cuad-dots">${dots}</div>
    <button type="button" class="cuad-side prev" onclick="irTomo(-1)" aria-label="Tomo anterior">‹</button>
    <button type="button" class="cuad-side next" onclick="irTomo(1)" aria-label="Tomo siguiente">›</button>
    ${acts.join('')}`;
  bindCuadernoGestos(root);
  root.onscroll = () => {
    const h = root.clientHeight || 1;
    const i = Math.round(root.scrollTop / h);
    root.querySelectorAll('.cuad-dots i').forEach((d,k)=>d.classList.toggle('on', k===i));
  };
}

/* ═══════════════════════════════════════════
   EJES
═══════════════════════════════════════════ */
function renderEjes(){
  const cont=document.getElementById('eje-filters');
  cont.innerHTML=`<button class="eje-pill active" onclick="filtrarEjePrincipal('',this)">Todos</button>`+
    Object.entries(EJES_CONFIG).map(([n,cfg])=>`<button class="eje-pill" onclick="filtrarEjePrincipal('${n}',this)">${cfg.icon} ${n}</button>`).join('');
  document.getElementById('eje-filters-sub').innerHTML='';
}
function filtrarEjePrincipal(eje,btn){
  ejeActivo=eje||null;subEjeActivo=null;paginaActual=1;
  document.querySelectorAll('#eje-filters .eje-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const subCont=document.getElementById('eje-filters-sub');
  if(eje&&EJES_CONFIG[eje]){
    subCont.innerHTML=Object.entries(EJES_CONFIG[eje].sub).map(([n,ic])=>`<button class="eje-pill sub" onclick="filtrarSubEje('${n}',this)">${ic || EJES_CONFIG[eje].icon} ${n}</button>`).join('');
  }else{subCont.innerHTML='';}
  renderLibros();
}
function filtrarSubEje(sub,btn){
  subEjeActivo=subEjeActivo===sub?null:sub;paginaActual=1;
  document.querySelectorAll('#eje-filters-sub .eje-pill').forEach(b=>b.classList.remove('active'));
  if(subEjeActivo)btn.classList.add('active');
  renderLibros();
}
function filtrarEje(eje,btn){filtrarEjePrincipal(eje,btn);}

/* ═══════════════════════════════════════════
   SEARCH
═══════════════════════════════════════════ */
function onSearch(v){
  searchQ=v.trim().toLowerCase();
  paginaActual=1;
  document.getElementById('search-clear').classList.toggle('vis',!!v);
  renderLibros();
  buscarEnLecciones(searchQ);
}
function clearSearch(){
  document.getElementById('search-input').value='';
  document.getElementById('search-results-lecs').style.display='none';
  onSearch('');
}
function buscarEnLecciones(q){
  const cont=document.getElementById('search-results-lecs');
  if(!q||q.length<2){cont.style.display='none';return;}
  const ql=q.toLowerCase();
  const resultados=lecs.filter(l=>
    l.titulo?.toLowerCase().includes(ql)||
    l.cuerpo?.toLowerCase().includes(ql)||
    l.aplicacion_practica?.toLowerCase().includes(ql)
  ).slice(0,8);
  if(!resultados.length){cont.style.display='none';return;}
  const libroMap={};
  libros.forEach(l=>libroMap[l.id]=l);
  cont.innerHTML=resultados.map(l=>{
    const libro=libroMap[l.libro_id];
    const textoBase=l.cuerpo||l.aplicacion_practica||'';
    const idx=textoBase.toLowerCase().indexOf(ql);
    const raw=idx>=0?textoBase.slice(Math.max(0,idx-40),idx+80):'';
    const snippet=raw?'...'+esc(raw).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi'),'<mark class="hl">$1</mark>')+'...':'';
    return `<div class="search-lec-item" onclick="verLeccion('${l.id}')">
      <div class="search-lec-title">${hl(l.titulo,q)}</div>
      <div class="search-lec-book">${libro?esc(libro.titulo):''} ${libro?'· '+esc(libro.autor):''}</div>
      ${snippet?`<div class="search-lec-snippet">${snippet}</div>`:''}
    </div>`;
  }).join('');
  cont.style.display='block';
}
function hl(text,q){
  if(!q||!text)return text||'';
  const safe=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return safe.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi'),'<mark class="hl">$1</mark>');
}

/* ═══════════════════════════════════════════
   LIBROS
═══════════════════════════════════════════ */
function filtrarLibrosActivos(){
  let f=libros;
  if(ejeActivo)f=f.filter(l=>getEjePrincipal(l)===ejeActivo);
  if(subEjeActivo)f=f.filter(l=>getSubEje(l)===subEjeActivo);
  if(searchQ)f=f.filter(l=>l.titulo?.toLowerCase().includes(searchQ)||l.autor?.toLowerCase().includes(searchQ)||getEjePrincipal(l)?.toLowerCase().includes(searchQ));
  return f;
}
function renderPaginacion(total,pag,totalPags){
  const old=document.getElementById('paginacion-row');if(old)old.remove();
  if(totalPags<=1)return;
  const cont=document.getElementById('libros-container');
  const div=document.createElement('div');div.id='paginacion-row';div.className='pag-row';div.style.gridColumn='1 / -1';
  let html=`<button class="pag-btn" onclick="irPagina(${pag-1})" ${pag===1?'disabled':''}>←</button>`;
  const rango=[];for(let i=1;i<=totalPags;i++){if(i===1||i===totalPags||(i>=pag-2&&i<=pag+2))rango.push(i);else if(rango[rango.length-1]!=='…')rango.push('…');}
  rango.forEach(p=>{if(p==='…')html+=`<span class="pag-info">…</span>`;else html+=`<button class="pag-btn ${p===pag?'active':''}" onclick="irPagina(${p})">${p}</button>`;});
  html+=`<button class="pag-btn" onclick="irPagina(${pag+1})" ${pag===totalPags?'disabled':''}>→</button>`;
  html+=`<span class="pag-info">${(pag-1)*PAGE_SIZE+1}–${Math.min(pag*PAGE_SIZE,total)} de ${total}</span>`;
  div.innerHTML=html;cont.appendChild(div);
}
function irPagina(p){
  const tp=Math.ceil(filtrarLibrosActivos().length/PAGE_SIZE);
  if(p<1||p>tp)return;
  paginaActual=p;renderLibros();window.scrollTo(0,0);
}
function renderLibros(){
  const f=filtrarLibrosActivos();
  const total=f.length;
  const totalPags=Math.max(1,Math.ceil(total/PAGE_SIZE));
  if(paginaActual>totalPags)paginaActual=1;
  const pagina=f.slice((paginaActual-1)*PAGE_SIZE,paginaActual*PAGE_SIZE);
  const cont=document.getElementById('libros-container');
  const lbl=document.getElementById('libros-count-label');
  const ejeLabel=subEjeActivo?`${ejeIcon(subEjeActivo)} ${subEjeActivo}`:ejeActivo?`${ejeIcon(ejeActivo)} ${ejeActivo}`:'Todos los libros';
  lbl.innerHTML=`${ejeLabel} <span style="opacity:0.6;font-size:0.9em">(${total})</span>`;
  if(!total){cont.innerHTML=`<div class="empty">Sin resultados</div>`;renderPaginacion(0,1,1);return;}
  const comp=completadasSet();
  cont.innerHTML=pagina.map(libro=>{
    const lecsL=lecs.filter(l=>l.libro_id===libro.id);
    const done=lecsL.filter(l=>comp.has(l.id)).length;
    const pct=lecsL.length?Math.round(done/lecsL.length*100):0;
    const fav=favLibros().includes(libro.id);
    const tHL=hl(libro.titulo,searchQ);
    const aHL=hl(libro.autor,searchQ);
    const subE=getSubEje(libro);
    const coverHTML=libro.portada_url
      ?`<div class="libro-cover-wrap"><img class="libro-cover" src="${libro.portada_url}" alt="${esc(libro.titulo)}" loading="lazy" data-eje="${esc(subE)}" onload="if(this.naturalWidth<=1) handleCoverError(this, this.dataset.eje)" onerror="handleCoverError(this, this.dataset.eje)"></div>`
      :`<div class="libro-cover-wrap" id="cover-${libro.id}">${makePlaceholder(ejeIcon(subE),subE||'')}</div>`;
    const isDone=pct===100&&lecsL.length>0;
    return `<div class="libro-card${isDone?' completado':''}" onclick="verLibro('${libro.id}')">
      ${isDone?'<div class="libro-done-badge">✓ 100%</div>':''}
      ${coverHTML}
      <div class="libro-body">
        <div class="libro-title">${tHL}</div>
        <div class="libro-autor">${aHL}</div>
        <div class="libro-footer">
          <div class="libro-prog-wrap">
            <div class="libro-prog-bar"><div class="libro-prog-fill" style="width:${pct}%"></div></div>
            <div class="libro-prog-text">${done}/${lecsL.length} lec · ${pct}%</div>
          </div>
          <div class="libro-actions">
            <span class="eje-tag" style="color:${ejeColor(subE)};border-color:${ejeColor(subE)}30;background:${ejeColor(subE)}0a">${esc(subE||'—')}</span>
            <button class="fav-btn ${fav?'on':''}" onclick="event.stopPropagation();toggleFavLib('${libro.id}',this)">${fav?'★':'☆'}</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
  renderPaginacion(total,paginaActual,totalPags);
  pagina.filter(libro=>!libro.portada_url).forEach(libro=>{
    getCover(libro.autor,libro.titulo,libro.id).then(url=>{
      if(!url)return;
      const subE=getSubEje(libro);
      const wrap=document.getElementById(`cover-${libro.id}`);
      if(wrap)wrap.innerHTML=`<img class="libro-cover" src="${url}" alt="${esc(libro.titulo)}" loading="lazy" data-eje="${esc(subE)}" onload="if(this.naturalWidth<=1) handleCoverError(this, this.dataset.eje)" onerror="handleCoverError(this, this.dataset.eje)">`;
      libro.portada_url=url;
    });
  });
}

function makePlaceholder(icon, eje){
  return `<div class="libro-cover-placeholder"><span class="ph-icon">${icon}</span><span class="ph-eje">${eje}</span></div>`;
}

/* ═══════════════════════════════════════════
   ESQUEMAS
═══════════════════════════════════════════ */
const ESQUEMAS_DATA = [
  {
    key: 'cialdini',
    titulo: 'Los 6 Principios de Influencia',
    autor: 'Robert Cialdini',
    eje: 'Psicología',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
    file: 'esquemas/cialdini.html',
    disponible: true
  },
  {
    key: 'weinstein',
    titulo: 'Los 4 Estadios del Mercado',
    autor: 'Stan Weinstein',
    eje: 'Financiero',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
    file: 'esquemas/weinstein.html',
    disponible: true
  },
  {
    key: 'kahneman',
    titulo: 'Sistema 1 vs Sistema 2',
    autor: 'Daniel Kahneman',
    eje: 'Psicología',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>',
    file: 'esquemas/kahneman.html',
    disponible: true
  },
  {
    key: 'autores',
    titulo: 'Mapa de Conexiones del Corpus',
    autor: 'Todos los autores',
    eje: 'Epistemológico',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>',
    file: 'esquemas/autores.html',
    disponible: true
  },
  {
    key: 'mcgilchrist',
    titulo: 'El Maestro y su Emisario',
    autor: 'Iain McGilchrist',
    eje: 'Neurociencia',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 0-.201 1.13l1.208 2.766a2.41 2.41 0 0 1-1.076 3.12 2.4 2.4 0 0 1-3.238-.809l-1.666-2.585a.98.98 0 0 0-1.114-.41l-2.906.879a2.41 2.41 0 0 1-3.04-3.04l.88-2.906a.98.98 0 0 0-.41-1.114L5.3 13.681a2.4 2.4 0 0 1-.81-3.238 2.41 2.41 0 0 1 3.121-1.076l2.766 1.208a.98.98 0 0 0 1.13-.201l1.611-1.611c.47-.47 1.087-.706 1.704-.706s1.233.235 1.704.706l1.568 1.568c.23.23.556.338.878.289z"/></svg>',
    file: 'esquemas/mcgilchrist.html',
    disponible: true
  },
  {
    key: 'fourth-turning',
    titulo: 'Los Ciclos Generacionales',
    autor: 'Strauss & Howe',
    eje: 'Civilizacional',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    file: 'esquemas/fourth_turning.html',
    disponible: true
  },
  {
    key: 'taleb',
    titulo: 'Antifrágil — Mapa del Riesgo',
    autor: 'Nassim N. Taleb',
    eje: 'Epistemológico',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    file: 'esquemas/taleb.html',
    disponible: true
  },
  {
    key: 'observatorio',
    titulo: 'Observatorio de Transiciones',
    autor: 'Strauss & Howe · Taleb · Mises · McGilchrist',
    eje: 'Civilizacional',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>',
    file: 'esquemas/observatorio.html',
    disponible: true
  },
  {
    key: 'tetlock',
    titulo: 'Superforecasting Framework',
    autor: 'Philip Tetlock',
    eje: 'Epistemológico',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    file: 'esquemas/tetlock.html',
    disponible: true
  }
];

function renderEsquemas(){
  const grid = document.getElementById('esquemas-grid');
  if(!grid) return;
  grid.innerHTML = ESQUEMAS_DATA.map(e => {
    const color = ejeColor(e.eje);
    const ejeTagClass = ejeClass(e.eje);
    return `<div class="esquema-card ${e.disponible?'':'proximamente'}"
      onclick="${e.disponible?`abrirEsquema('${e.key}')`:''}"
      title="${e.disponible?'Abrir esquema interactivo':'Próximamente'}">
      <div class="esquema-thumb" style="background:linear-gradient(135deg,${color}18,${color}08);">
        <span class="esquema-thumb-icon" style="text-shadow:0 0 20px ${color}60">${e.icon}</span>
      </div>
      <div class="esquema-body">
        <div class="esquema-title">${e.titulo}</div>
        <div class="esquema-autor">${e.autor}</div>
        <div class="esquema-footer">
          <span class="esquema-eje-tag ${ejeTagClass}">${ejeIcon(e.eje)} ${e.eje}</span>
          <span class="esquema-badge ${e.disponible?'disponible':'pronto'}">${e.disponible?'● Disponible':'Próximamente'}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function esquemaDeLibro(libro){
  if (!libro) return null;
  const a = (libro.autor || '').toLowerCase();
  const t = (libro.titulo || '').toLowerCase();
  const hay = s => a.includes(s) || t.includes(s);
  const key =
    hay('cialdini') ? 'cialdini' :
    hay('weinstein') ? 'weinstein' :
    hay('kahneman') ? 'kahneman' :
    hay('mcgilchrist') ? 'mcgilchrist' :
    (hay('taleb') || hay('antifrágil') || hay('antifragil')) ? 'taleb' :
    (hay('tetlock') || hay('superforecast')) ? 'tetlock' :
    (hay('strauss') || hay('howe') || hay('fourth turning') || hay('cuarto giro')) ? 'fourth-turning' :
    null;
  if (!key) return null;
  return ESQUEMAS_DATA.find(e => e.key === key && e.disponible) || null;
}
let esquemaReturn = 'esquemas';
function abrirEsquema(key, from){
  const e = ESQUEMAS_DATA.find(x=>x.key===key);
  if(!e||!e.disponible){ toast('Esquema próximamente'); return; }
  const basePath = window.location.pathname.endsWith('/')
    ? window.location.pathname
    : window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
  const url = window.location.origin + basePath + e.file;
  const iframe = document.getElementById('esquema-iframe');
  const title = document.getElementById('esquema-viewer-title');
  if (iframe && title) {
    iframe.src = url;
    title.textContent = e.titulo;
    esquemaReturn = from || 'esquemas';
    const back = document.getElementById('esquema-back-btn');
    if (back) back.textContent = esquemaReturn === 'leccion' ? '← Folio' : '← Esquemas';
    showView('esquema-viewer');
    return;
  }
  window.open(url, '_blank');
}
function volverDeEsquema(){
  if (esquemaReturn === 'leccion' && lecActual) { verLeccion(lecActual.id); return; }
  showView('esquemas');
}

function esquemaFullscreen(){}

/* ═══════════════════════════════════════════
   VER LIBRO
═══════════════════════════════════════════ */
function verLibro(id){
  libroActual=libros.find(l=>l.id===id);
  if(!libroActual)return;
  addUltimo(id);
  lecFilter='all';
  document.querySelector('.lec-tab.active')?.classList.remove('active');
  document.querySelectorAll('.lec-tab')[0]?.classList.add('active');
  document.getElementById('search-lecs').value='';
  renderLibroHero(); renderLecs(lecs.filter(l=>l.libro_id===id)); showView('lecciones');
}

function renderLibroHero(){
  const l=libroActual;
  const comp=completadasSet();
  const lecsL=lecs.filter(x=>x.libro_id===l.id);
  const done=lecsL.filter(x=>comp.has(x.id)).length;
  const pct=lecsL.length?Math.round(done/lecsL.length*100):0;
  const coverHTML = l.portada_url
    ? `<img class="libro-hero-cover" src="${l.portada_url}" alt="${l.titulo}" loading="lazy">`
    : `<div class="libro-hero-cover-ph" id="hero-cover-ph">${ejeIcon(l.eje)}</div>`;
  document.getElementById('libro-hero-cont').innerHTML=`
    <div class="libro-hero">
      ${coverHTML}
      <div class="libro-hero-info">
        <div class="libro-hero-title">${esc(l.titulo)}</div>
        <div class="libro-hero-autor">${esc(l.autor)}</div>
        ${l.descripcion_breve?`<div class="libro-hero-desc">${esc(l.descripcion_breve)}</div>`:''}
        <div class="libro-hero-stats">
          <span class="libro-hero-stat"><span>${lecsL.length}</span> lecciones</span>
          <span class="libro-hero-stat"><span>${done}</span> completadas</span>
          <span class="libro-hero-stat"><span>${pct}%</span> progreso</span>
        </div>
        <div style="margin-top:0.8rem;display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
          <span class="eje-tag ${ejeClass(l.eje)}">${ejeIcon(l.eje)} ${esc(l.eje||'—')}</span>
          ${esquemaDeLibro(l)?`<button class="act-btn secondary" style="padding:0.3rem 0.75rem;font-size:0.7rem" onclick="event.stopPropagation();abrirEsquema('${esquemaDeLibro(l).key}')">Mapa</button>`:''}
          <button class="act-btn secondary" style="padding:0.3rem 0.75rem;font-size:0.7rem" onclick="testDelLibro('${l.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg> Test</button>
          <button class="act-btn secondary" style="padding:0.3rem 0.75rem;font-size:0.7rem" onclick="abrirPdfModal()">⬇ PDF</button>
          <button class="act-btn secondary" style="padding:0.3rem 0.75rem;font-size:0.7rem" onclick="compartirLibro()">🔗 Compartir</button>
        </div>
      </div>
    </div>`;
  if(!l.portada_url){
    getCover(l.autor, l.titulo, l.id).then(url=>{
      if(!url) return;
      l.portada_url=url;
      const ph=document.getElementById('hero-cover-ph');
      if(ph) ph.outerHTML=`<img class="libro-hero-cover" src="${url}" alt="${l.titulo}" loading="lazy">`;
    });
  }
}

function onSearchLecs(v){
  const q=v.trim().toLowerCase();
  const pool=lecs.filter(l=>l.libro_id===libroActual?.id);
  const f=q?pool.filter(l=>l.titulo?.toLowerCase().includes(q)||l.cuerpo?.toLowerCase().includes(q)):pool;
  renderLecs(f,q);
}

function filtrarLecs(tipo,btn){
  lecFilter=tipo;
  document.querySelectorAll('.lec-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const comp=completadasSet();
  let pool=lecs.filter(l=>l.libro_id===libroActual?.id);
  if(tipo==='pending') pool=pool.filter(l=>!comp.has(l.id));
  if(tipo==='done')    pool=pool.filter(l=>comp.has(l.id));
  renderLecs(pool);
}

function renderLecs(list,q=''){
  const comp=completadasSet();
  const cont=document.getElementById('lecciones-container');
  if(!list.length){cont.innerHTML=`<div class="empty">Sin lecciones</div>`;return;}
  cont.innerHTML=list.map(l=>{
    const done=comp.has(l.id);
    const nA=l.autores_relacionados?.length||0;
    const tHL=hl(l.titulo,q);
    const fav=favLecs().includes(l.id);
    return `<div class="lec-item ${done?'done':''}" onclick="verLeccion('${l.id}')">
      <div class="lec-left">
        <div class="lec-title">${tHL}</div>
        <div class="lec-meta">
          <span class="lec-num">${l.orden?`#${l.orden}`:''}</span>
          ${nA?`<span class="lec-authors">🔗 ${nA} autor${nA>1?'es':''}</span>`:''}
        </div>
      </div>
      <div class="lec-right">
        <button class="fav-btn ${fav?'on':''}" onclick="event.stopPropagation();toggleFavLec('${l.id}',this)">${fav?'★':'☆'}</button>
        <span class="lec-status ${done?'ok':'no'}">${done?'✓':'○'}</span>
      </div>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════
   VER LECCION
═══════════════════════════════════════════ */
function verLeccion(id, from=null){
  lecActual=lecs.find(l=>l.id===id);
  if(!lecActual)return;
  const libId=lecActual.libro_id;
  if(!libroActual) libroActual=libros.find(l=>l.id===libId);
  setUltima(id, libId);
  const backBtn=document.getElementById('back-lec-btn');
  if(from==='repaso'){backBtn.onclick=()=>showView('repaso');backBtn.textContent='← Repaso';}
  else if(from==='autor'){backBtn.onclick=()=>showView('autor');backBtn.textContent='← Autor';}
  else if(from==='favoritos'){backBtn.onclick=()=>showView('favoritos');backBtn.textContent='← Favoritos';}
  else{backBtn.onclick=()=>volverDeLeccion();backBtn.textContent='← Lecciones';}

  const comp=completadasSet();
  const done=comp.has(id);
  const fav=favLecs().includes(id);
  const libro=libros.find(l=>l.id===lecActual.libro_id);
  let html='';

  if(lecActual.imagen_principal){
    html+=`<div class="lec-img-wrap">
      <img src="${lecActual.imagen_principal}" alt="${esc(lecActual.titulo)}" loading="lazy" referrerpolicy="no-referrer"
        onerror="this.parentElement.style.display='none'">
      ${lecActual.imagen_caption?`<div class="lec-img-cap">${esc(lecActual.imagen_caption)}</div>`:''}
    </div>`;
  }

  html+=`<article class="folio">`;
  html+=`<h2 class="lec-titulo">${esc(lecActual.titulo)}</h2>`;
  html+=`<div class="lec-meta-header">
    ${libro?`<span class="lec-meta-libro">${esc(libro.titulo)} — ${esc(libro.autor)}</span>`:''}
    ${lecActual.orden?`<span class="lec-ord">Lección ${lecActual.orden}</span>`:''}
    ${done?`<span class="lec-done">Completada</span>`:''}
  </div>`;
  const mapa = esquemaDeLibro(libro);
  if (mapa) {
    html+=`<p class="folio-mapa"><button type="button" class="folio-mapa-btn" onclick="abrirEsquema('${mapa.key}','leccion')">Ver el mapa · ${esc(mapa.titulo)}</button></p>`;
  }

  html+=`<div class="lec-body fmt">${fmt(lecActual.cuerpo)}</div>`;

  html+=`<div class="tts-player" id="tts-player">
    <button class="tts-btn tts-play" id="tts-play-btn" onclick="ttsTogglePlay()" title="Reproducir">
      <svg viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20"/></svg>
    </button>
    <div class="tts-info">
      <span class="tts-label">Escuchar lección</span>
      <span class="tts-engine" id="tts-engine"></span>
    </div>
    <span class="tts-status" id="tts-status"></span>
    <button class="tts-btn" id="tts-download-btn" onclick="ttsDownload()" title="Descargar MP3" style="display:none">
      <svg viewBox="0 0 24 24"><path d="M12 16l-6-6h4V4h4v6h4l-6 6z"/><rect x="4" y="18" width="16" height="2" rx="1"/></svg>
    </button>
    <button class="tts-btn" id="tts-stop-btn" onclick="ttsStop()" title="Detener" style="display:none">
      <svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
    </button>
  </div>`;

  if(lecActual.detalles?.length){
    html+=`<div class="det-grid">`+
      lecActual.detalles.map(d=>`
        <div class="det-card">
          <div class="det-card-title">${esc(d.subtitulo||d.titulo||'')}</div>
          <div class="fmt">${fmt(d.cuerpo||d.contenido||'')}</div>
        </div>`).join('')+`</div>`;
  }

  if(lecActual.aplicacion_practica){
    const bodyTxt = (lecActual.cuerpo||'').toLowerCase();
    const aplTxt  = lecActual.aplicacion_practica.slice(0,60).toLowerCase();
    const yaEnCuerpo = aplTxt.length > 10 && bodyTxt.includes(aplTxt);
    if(!yaEnCuerpo){
      html+=`<div class="aplic-box">
        <div class="aplic-label">Mañana</div>
        <div class="fmt">${fmt(lecActual.aplicacion_practica)}</div>
      </div>`;
    }
  }

  if(lecActual.conexion_cruzada){
    html+=`<div class="con-box">
      <div class="con-label">Cruce</div>
      <div class="fmt">${fmt(lecActual.conexion_cruzada)}</div>
    </div>`;
  }

  if(lecActual.autocorreccion){
    html+=`<div class="auto-box">
      <div class="auto-label">El giro</div>
      <div class="fmt">${fmt(lecActual.autocorreccion)}</div>
    </div>`;
  }

  if(lecActual.autores_relacionados?.length){
    html+=`<div class="autores-kicker">Autores relacionados</div>`;
    html+=`<div class="autores-rel">`+
      lecActual.autores_relacionados.map(a=>`<span class="autor-tag" onclick="verAutor('${encodeURIComponent(a)}')">${a}</span>`).join('')+`</div>`;
  }

  const notaGuardada=(getNotas(id)||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  html+=`<div class="notas-section">
    <div class="notas-label">Al margen</div>
    <textarea class="notas-area" id="nota-${id}" placeholder="Una frase. No un resumen.">${notaGuardada}</textarea>
    <button class="notas-save" onclick="guardarNota('${id}')">Guardar nota</button>
  </div></article>`;

  const lecsL=lecs.filter(l=>l.libro_id===lecActual.libro_id).sort((a,b)=>a.orden-b.orden);
  const idx=lecsL.findIndex(l=>l.id===id);
  const prev=idx>0?lecsL[idx-1]:null;
  const sig=idx>=0&&idx<lecsL.length-1?lecsL[idx+1]:null;

  html+=`<div class="lec-actions">
    ${!done
      ?`<button class="act-btn primary" onclick="marcarCompletada('${id}')">✓ Marcar completada</button>`
      :`<button class="act-btn done-mark" disabled>✓ Completada</button>`}
    <button class="act-btn secondary" id="btn-fav-lec" onclick="toggleFavLecDetalle('${id}',this)">${fav?'★ Favorita':'☆ Favoritos'}</button>
    <button class="act-btn secondary" onclick="compartirLeccion()">🔗 Compartir</button>
    <button class="act-btn secondary" onclick="abrirPdfModal()">⬇ PDF</button>
    <button class="act-btn secondary" onclick="testDelLibro('${lecActual.libro_id}')"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg> Test</button>
    ${prev?`<button class="act-btn secondary" onclick="verLeccion('${prev.id}');window.scrollTo(0,0)">← Anterior</button>`:''}
    ${sig?`<button class="act-btn primary" onclick="verLeccion('${sig.id}');window.scrollTo(0,0)">Siguiente →</button>`:''}
  </div>`;

  document.getElementById('leccion-contenido').innerHTML=html;
  const cont=document.getElementById('leccion-contenido');
  if(cont){ cont.dataset.prev=prev?prev.id:''; cont.dataset.sig=sig?sig.id:''; }
  bindFolioGestos();
  showView('leccion');
  // Inicializar subrayados si el módulo está disponible
  if(typeof SCSSubrayados !== 'undefined' && SCSSubrayados.init) {
    SCSSubrayados.init(lecActual.id);
  }
}

function guardarNota(id){const ta=document.getElementById(`nota-${id}`);if(ta){saveNota(id,ta.value).then(()=>toast('📝 Nota guardada'));}}
function toggleFavLecDetalle(id,btn){toggleFavLec(id,btn);btn.textContent=favLecs().includes(id)?'★ Favorita':'☆ Favoritos';}
function volverDeLeccion(){if(libroActual)showView('lecciones');else showView('home');}

let folioGestosBound=false, folioLock=false, folioX0=0, folioY0=0, folioAcc=0;
function irLeccionFolio(dir){
  const cont=document.getElementById('leccion-contenido');
  if(!cont||folioLock) return;
  const id=dir>0?cont.dataset.sig:cont.dataset.prev;
  if(!id){ toast(dir>0?'Última lección del tomo':'Primera lección del tomo'); return; }
  folioLock=true;
  const folio=cont.querySelector('.folio');
  if(folio) folio.classList.add(dir>0?'slide-out-left':'slide-out-right');
  setTimeout(()=>{
    verLeccion(id);
    window.scrollTo(0,0);
    requestAnimationFrame(()=>{
      const f=document.querySelector('#leccion-contenido .folio');
      if(f) f.classList.add('slide-in');
    });
    folioLock=false;
  }, 260);
}
function folioTargetOK(t){
  return !t.closest('textarea, input, button, a, .notas-area, .tts-player');
}
function bindFolioGestos(){
  const view=document.getElementById('view-leccion');
  if(!view||folioGestosBound) return;
  folioGestosBound=true;
  view.addEventListener('touchstart', e=>{
    if(!folioTargetOK(e.target)) return;
    const t=e.changedTouches[0]; folioX0=t.clientX; folioY0=t.clientY;
  }, {passive:true});
  view.addEventListener('touchend', e=>{
    if(!document.getElementById('view-leccion').classList.contains('active')) return;
    const t=e.changedTouches[0];
    const dx=t.clientX-folioX0, dy=t.clientY-folioY0;
    if(Math.abs(dx)<72||Math.abs(dx)<Math.abs(dy)*1.25) return;
    irLeccionFolio(dx<0?1:-1);
  }, {passive:true});
  view.addEventListener('wheel', e=>{
    if(!document.getElementById('view-leccion').classList.contains('active')) return;
    if(!folioTargetOK(e.target)) return;
    if(Math.abs(e.deltaX)<=Math.abs(e.deltaY)||Math.abs(e.deltaX)<10){ folioAcc=0; return; }
    e.preventDefault();
    folioAcc+=e.deltaX;
    if(Math.abs(folioAcc)>90){ irLeccionFolio(folioAcc>0?1:-1); folioAcc=0; }
  }, {passive:false});
  document.addEventListener('keydown', e=>{
    if(!document.getElementById('view-leccion')?.classList.contains('active')) return;
    if(e.target.closest('textarea, input')) return;
    if(e.key==='ArrowRight'){ e.preventDefault(); irLeccionFolio(1); }
    if(e.key==='ArrowLeft'){ e.preventDefault(); irLeccionFolio(-1); }
  });
}

/* ═══════════════════════════════════════════
   TTS — Google Cloud TTS (directo) + Web Speech API fallback
   Cache local en IndexedDB para no regenerar audio
═══════════════════════════════════════════ */
const GCLOUD_TTS_KEY='AIzaSyAr_AtWkVbr6FAZbAlT3h5gSt9o4D_vnE0';
const GCLOUD_TTS_URL='https://texttospeech.googleapis.com/v1beta1/text:synthesize';
const TTS_CACHE_DB='scs-tts-cache-v3';
const TTS_CACHE_STORE='audio';
const TTS_MAX_BYTES=4800;

let ttsUtterance=null;
let ttsPaused=false;
let ttsAudio=null;
let ttsAudioBlob=null;
let ttsMode=null;

function ttsGetText(){
  if(!lecActual||!lecActual.cuerpo) return '';
  return lecActual.cuerpo
    .replace(/[#*_`~>|[\](){}]/g,'')
    .replace(/\n{2,}/g,'. ')
    .replace(/\n/g,' ')
    .replace(/\s{2,}/g,' ')
    .trim();
}

/* Convert plain text to SSML with natural pauses */
function ttsToSSML(text){
  let ssml=text
    .replace(/\.\s+/g,'.<break time="600ms"/> ')
    .replace(/;\s+/g,';<break time="400ms"/> ')
    .replace(/:\s+/g,':<break time="400ms"/> ')
    .replace(/,\s+/g,', ');
  return `<speak>${ssml}</speak>`;
}

/* ── IndexedDB cache ── */
function ttsCacheOpen(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(TTS_CACHE_DB,1);
    req.onupgradeneeded=()=>req.result.createObjectStore(TTS_CACHE_STORE);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function ttsCacheGet(id){
  try{
    const db=await ttsCacheOpen();
    return new Promise((resolve)=>{
      const tx=db.transaction(TTS_CACHE_STORE,'readonly');
      const req=tx.objectStore(TTS_CACHE_STORE).get(id);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>resolve(null);
    });
  }catch(_){return null;}
}
async function ttsCachePut(id,blob){
  try{
    const db=await ttsCacheOpen();
    const tx=db.transaction(TTS_CACHE_STORE,'readwrite');
    tx.objectStore(TTS_CACHE_STORE).put(blob,id);
  }catch(_){}
}

/* ── Text chunking (Google TTS limit ~5000 bytes per request) ── */
function ttsChunkText(text){
  const enc=new TextEncoder();
  if(enc.encode(text).length<=TTS_MAX_BYTES) return [text];
  const sentences=text.split(/(?<=[.!?])\s+/);
  const chunks=[];
  let current='';
  for(const s of sentences){
    const candidate=current?current+' '+s:s;
    if(enc.encode(candidate).length>TTS_MAX_BYTES){
      if(current) chunks.push(current);
      current=s;
    }else{
      current=candidate;
    }
  }
  if(current) chunks.push(current);
  return chunks;
}

/* ── Google Cloud TTS API call ── */
async function ttsCallGoogle(text){
  const chunks=ttsChunkText(text);
  const audioParts=[];
  for(const chunk of chunks){
    const resp=await fetch(`${GCLOUD_TTS_URL}?key=${GCLOUD_TTS_KEY}`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        input:{ssml:ttsToSSML(chunk)},
        voice:{languageCode:'es-ES',name:'es-ES-Journey-D'},
        audioConfig:{audioEncoding:'MP3',speakingRate:0.95,pitch:-1.0}
      })
    });
    if(!resp.ok) throw new Error(`Google TTS ${resp.status}`);
    const data=await resp.json();
    const raw=atob(data.audioContent);
    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
    audioParts.push(bytes);
  }
  const totalLen=audioParts.reduce((s,p)=>s+p.length,0);
  const result=new Uint8Array(totalLen);
  let offset=0;
  for(const part of audioParts){result.set(part,offset);offset+=part.length;}
  return new Blob([result],{type:'audio/mpeg'});
}

/* ── UI update ── */
function ttsUpdateUI(state){
  const playBtn=document.getElementById('tts-play-btn');
  const stopBtn=document.getElementById('tts-stop-btn');
  const dlBtn=document.getElementById('tts-download-btn');
  const status=document.getElementById('tts-status');
  const engine=document.getElementById('tts-engine');
  if(!playBtn) return;

  const showDl=ttsMode==='cloud'&&ttsAudioBlob;

  if(state==='loading'){
    playBtn.innerHTML='<svg viewBox="0 0 24 24" class="tts-spin"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="31 31"/></svg>';
    playBtn.disabled=true;
    stopBtn.style.display='none';
    dlBtn.style.display='none';
    status.textContent='Generando audio…';
    if(engine) engine.textContent='';
  } else if(state==='playing'){
    playBtn.innerHTML='<svg viewBox="0 0 24 24"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg>';
    playBtn.title='Pausar';
    playBtn.disabled=false;
    stopBtn.style.display='flex';
    dlBtn.style.display=showDl?'flex':'none';
    status.textContent='Reproduciendo…';
    if(engine) engine.textContent=ttsMode==='cloud'?'Google Cloud':'Voz del navegador';
  } else if(state==='paused'){
    playBtn.innerHTML='<svg viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20"/></svg>';
    playBtn.title='Reanudar';
    playBtn.disabled=false;
    stopBtn.style.display='flex';
    dlBtn.style.display=showDl?'flex':'none';
    status.textContent='En pausa';
  } else {
    playBtn.innerHTML='<svg viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20"/></svg>';
    playBtn.title='Reproducir';
    playBtn.disabled=false;
    stopBtn.style.display='none';
    dlBtn.style.display='none';
    status.textContent='';
    if(engine) engine.textContent='';
    ttsPaused=false;
  }
}

/* ── Main toggle ── */
async function ttsTogglePlay(){
  if(ttsMode==='cloud'&&ttsAudio){
    if(!ttsAudio.paused&&!ttsAudio.ended){ttsAudio.pause();ttsUpdateUI('paused');return;}
    if(ttsAudio.paused&&!ttsAudio.ended){ttsAudio.play();ttsUpdateUI('playing');return;}
  }
  if(ttsMode==='webspeech'){
    const synth=window.speechSynthesis;
    if(synth.speaking&&!ttsPaused){synth.pause();ttsPaused=true;ttsUpdateUI('paused');return;}
    if(ttsPaused){synth.resume();ttsPaused=false;ttsUpdateUI('playing');return;}
  }

  const text=ttsGetText();
  if(!text){toast('No hay contenido para leer');return;}

  ttsStop();
  ttsUpdateUI('loading');

  try{
    const cacheId=lecActual.id;
    let blob=await ttsCacheGet(cacheId);
    if(!blob){
      blob=await ttsCallGoogle(text);
      await ttsCachePut(cacheId,blob);
    }
    ttsAudioBlob=blob;
    ttsMode='cloud';
    ttsPlayCloud(blob);
  }catch(e){
    console.warn('Google TTS failed, fallback to Web Speech:',e.message);
    ttsPlayWebSpeech(text);
  }
}

function ttsPlayCloud(blob){
  if(ttsAudio){ttsAudio.pause();ttsAudio=null;}
  const url=URL.createObjectURL(blob);
  ttsAudio=new Audio(url);
  ttsAudio.onplay=()=>ttsUpdateUI('playing');
  ttsAudio.onpause=()=>{if(!ttsAudio.ended)ttsUpdateUI('paused');};
  ttsAudio.onended=()=>ttsUpdateUI('idle');
  ttsAudio.onerror=()=>{
    toast('Error de audio, usando voz del navegador');
    ttsPlayWebSpeech(ttsGetText());
  };
  ttsAudio.play().catch(()=>ttsPlayWebSpeech(ttsGetText()));
}

function ttsPlayWebSpeech(text){
  ttsMode='webspeech';
  ttsAudioBlob=null;
  const synth=window.speechSynthesis;
  if(!synth){toast('Tu navegador no soporta síntesis de voz');ttsUpdateUI('idle');return;}

  synth.cancel();
  ttsUtterance=new SpeechSynthesisUtterance(text);
  ttsUtterance.lang='es-ES';
  ttsUtterance.rate=1;
  ttsUtterance.pitch=1;

  const voices=synth.getVoices();
  const esVoice=voices.find(v=>v.lang==='es-ES')||voices.find(v=>v.lang.startsWith('es'));
  if(esVoice) ttsUtterance.voice=esVoice;

  ttsUtterance.onstart=()=>ttsUpdateUI('playing');
  ttsUtterance.onend=()=>ttsUpdateUI('idle');
  ttsUtterance.onerror=()=>ttsUpdateUI('idle');
  ttsUtterance.onpause=()=>ttsUpdateUI('paused');
  ttsUtterance.onresume=()=>ttsUpdateUI('playing');

  synth.speak(ttsUtterance);
}

function ttsStop(){
  if(ttsAudio){ttsAudio.pause();ttsAudio.currentTime=0;ttsAudio=null;}
  const synth=window.speechSynthesis;
  if(synth){synth.cancel();}
  ttsUtterance=null;
  ttsPaused=false;
  ttsMode=null;
  ttsAudioBlob=null;
  ttsUpdateUI('idle');
}

function ttsDownload(){
  if(!ttsAudioBlob)return;
  const url=URL.createObjectURL(ttsAudioBlob);
  const a=document.createElement('a');
  a.href=url;
  const titulo=(lecActual?.titulo||'leccion').replace(/[^a-zA-Z0-9áéíóúñ ]/g,'').replace(/\s+/g,'-').toLowerCase();
  a.download=`${titulo}.mp3`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════
   MARCAR COMPLETADA
═══════════════════════════════════════════ */
async function marcarCompletada(id){
  try{
    await sb('progreso',{method:'POST',body:JSON.stringify({tipo:'leccion',item_id:id,resultado:'correcta',fecha:new Date().toISOString()})});
    prog.push({tipo:'leccion',item_id:id,resultado:'correcta',fecha:new Date().toISOString()});
    setNocheCerrada(id);
    toast('✓ Lección completada');
    renderStats(); renderAtril();
    if (!document.body.classList.contains('noche')) verLeccion(id);
  }catch(e){toast('Error: '+e.message);}
}

/* ═══════════════════════════════════════════
   PDF
═══════════════════════════════════════════ */
function abrirPdfModal(){
  const sub=document.getElementById('pdf-libro-sub');
  if(sub&&libroActual){
    const n=lecs.filter(l=>l.libro_id===libroActual.id).length;
    sub.textContent=`${libroActual.titulo} — ${n} lecciones`;
  }
  document.getElementById('pdf-modal').classList.remove('hidden');
}
function closePdfModal(){document.getElementById('pdf-modal').classList.add('hidden');}

/* ── PDF PREMIUM ENGINE ── */
const PDF_C={bg:[13,17,23],card:[22,27,34],blue:[88,166,255],green:[35,134,54],gold:[255,215,0],red:[255,107,107],purple:[179,146,240],text:[230,237,243],muted:[110,118,129],secondary:[139,148,158],border:[48,54,61]};
const PDF_ML=22,PDF_MR=22,PDF_MT=26,PDF_MB=22,PDF_PW=210,PDF_PH=297,PDF_CW=210-22-22;

function pdfDrawChrome(doc,meta,pn){
  doc.setFillColor(...PDF_C.bg);doc.rect(0,0,PDF_PW,PDF_PH,'F');
  doc.setFillColor(...PDF_C.blue);doc.rect(0,0,3,PDF_PH,'F');
  doc.setDrawColor(...PDF_C.border);doc.setLineWidth(0.15);
  doc.line(PDF_ML,18,PDF_PW-PDF_MR,18);
  doc.line(PDF_ML,PDF_PH-15,PDF_PW-PDF_MR,PDF_PH-15);
  doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(...PDF_C.muted);
  doc.text(`${meta.libro}  —  ${meta.autor}`,PDF_ML,14);
  doc.text(meta.eje||'',PDF_PW-PDF_MR,14,{align:'right'});
  doc.text('Mente fría',PDF_ML,PDF_PH-8);
  doc.setFillColor(...PDF_C.gold);doc.circle(PDF_PW/2,PDF_PH-7.5,0.8,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...PDF_C.blue);
  doc.text(String(pn),PDF_PW-PDF_MR,PDF_PH-8,{align:'right'});
}

function pdfCheckPage(doc,y,need,meta,pc){
  if(y+need>PDF_PH-PDF_MB){doc.addPage();pc.n++;pdfDrawChrome(doc,meta,pc.n);return PDF_MT;}
  return y;
}

function pdfDrawBody(doc,y,text,meta,pc){
  const paras=(text||'').replace(/\*\*(.+?)\*\*/g,'$1').replace(/\*(.+?)\*/g,'$1').replace(/`(.+?)`/g,'$1').split(/\n\n|\r\n\r\n/);
  doc.setFont('helvetica','normal');doc.setFontSize(10);
  for(const p of paras){
    const t=p.trim();if(!t)continue;
    const lines=doc.splitTextToSize(t,PDF_CW);
    for(const line of lines){
      y=pdfCheckPage(doc,y,5.5,meta,pc);
      doc.setTextColor(...PDF_C.text);doc.text(line,PDF_ML,y);y+=5.5;
    }
    y+=2.5;
  }
  return y;
}

function pdfDrawQuote(doc,y,q,meta,pc){
  if(!q||!q.trim())return y;
  const qW=PDF_CW-36;
  doc.setFont('helvetica','italic');doc.setFontSize(10.5);
  const lines=doc.splitTextToSize(`"${q}"`,qW);
  const bh=lines.length*5.5+12;
  y=pdfCheckPage(doc,y,bh,meta,pc);
  const cx=PDF_PW/2;
  doc.setDrawColor(...PDF_C.gold);doc.setLineWidth(0.2);
  doc.line(cx-25,y,cx+25,y);y+=5;
  doc.setTextColor(...PDF_C.gold);
  for(const l of lines){doc.text(l,cx,y,{align:'center'});y+=5.5;}
  y+=1;doc.line(cx-25,y,cx+25,y);y+=5;
  return y;
}

function pdfDrawCard(doc,y,label,lc,body,meta,pc){
  const barW=2.5,padL=6,padR=4,padTB=4,innerW=PDF_CW-barW-padL-padR;
  doc.setFont('helvetica','normal');doc.setFontSize(9);
  const bodyLines=doc.splitTextToSize((body||'').replace(/\*\*(.+?)\*\*/g,'$1').replace(/\*(.+?)\*/g,'$1'),innerW);
  const cardH=padTB+5+2+bodyLines.length*4.2+padTB;
  y=pdfCheckPage(doc,y,cardH+4,meta,pc);
  const cx=PDF_ML;
  doc.setFillColor(...PDF_C.card);doc.roundedRect(cx,y,PDF_CW,cardH,1.5,1.5,'F');
  doc.setFillColor(...lc);doc.rect(cx,y,barW,cardH,'F');
  doc.setDrawColor(...PDF_C.border);doc.setLineWidth(0.1);doc.roundedRect(cx,y,PDF_CW,cardH,1.5,1.5,'S');
  let ty=y+padTB+3.5;const tx=cx+barW+padL;
  doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...lc);
  doc.text(label,tx,ty);ty+=7;
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...PDF_C.text);
  for(const l of bodyLines){doc.text(l,tx,ty);ty+=4.2;}
  return y+cardH+4;
}

function pdfDrawCover(doc,meta){
  doc.setFillColor(...PDF_C.bg);doc.rect(0,0,PDF_PW,PDF_PH,'F');
  doc.setFillColor(...PDF_C.blue);doc.rect(0,0,3,PDF_PH,'F');
  doc.setFillColor(...PDF_C.gold);doc.rect(PDF_ML,70,PDF_CW,0.5,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(28);doc.setTextColor(...PDF_C.blue);
  const tl=doc.splitTextToSize(meta.libro,PDF_CW);let ty=95;
  for(const l of tl){doc.text(l,PDF_ML,ty);ty+=12;}
  doc.setFont('helvetica','normal');doc.setFontSize(14);doc.setTextColor(...PDF_C.secondary);
  doc.text(meta.autor,PDF_ML,ty+5);ty+=18;
  doc.setFontSize(10);doc.setTextColor(...PDF_C.muted);
  doc.text(`Eje: ${meta.eje||''}`,PDF_ML,ty);
  if(meta.n){ty+=8;doc.text(`${meta.n} lecciones`,PDF_ML,ty);}
  doc.setFillColor(...PDF_C.gold);doc.rect(PDF_ML,PDF_PH-70,PDF_CW,0.5,'F');
  doc.setFontSize(9);doc.setTextColor(...PDF_C.muted);
  doc.text('Mente fría',PDF_ML,PDF_PH-55);
  doc.setFontSize(7.5);
  doc.text(`Exportado: ${new Date().toLocaleDateString('es-ES',{year:'numeric',month:'long'})}`,PDF_ML,PDF_PH-48);
}

function pdfRenderLesson(doc,lec,meta,pc,lessonNum,totalLessons){
  let y=PDF_MT;
  if(lessonNum!=null){
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...PDF_C.bg);
    doc.setFillColor(...PDF_C.blue);doc.roundedRect(PDF_ML,y-3.5,20,6,1.5,1.5,'F');
    doc.text(`${lessonNum} / ${totalLessons}`,PDF_ML+10,y,{align:'center'});y+=7;
  } else {
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...PDF_C.secondary);
    doc.text(`${meta.libro}  |  ${meta.autor}`,PDF_ML,y);y+=8;
  }
  doc.setFont('helvetica','bold');doc.setFontSize(17);doc.setTextColor(...PDF_C.blue);
  const tl=doc.splitTextToSize(lec.titulo,PDF_CW);
  for(const l of tl){y=pdfCheckPage(doc,y,8,meta,pc);doc.text(l,PDF_ML,y);y+=8;}
  y+=1;doc.setFont('helvetica','italic');doc.setFontSize(8.5);doc.setTextColor(...PDF_C.muted);
  doc.text(`Eje: ${meta.eje||''}`,PDF_ML,y);y+=5;
  doc.setDrawColor(...PDF_C.border);doc.setLineWidth(0.15);doc.line(PDF_ML,y,PDF_PW-PDF_MR,y);y+=6;
  y=pdfDrawBody(doc,y,lec.cuerpo,meta,pc);y+=2;
  y=pdfDrawQuote(doc,y,lec.cita_memorable,meta,pc);
  if(lec.aplicacion_practica&&lec.aplicacion_practica.trim())
    y=pdfDrawCard(doc,y,'APLICACIÓN PRÁCTICA',PDF_C.green,lec.aplicacion_practica,meta,pc);
  if(lec.conexion_cruzada&&lec.conexion_cruzada.trim())
    y=pdfDrawCard(doc,y,'CONEXIÓN CRUZADA',PDF_C.blue,lec.conexion_cruzada,meta,pc);
  if(lec.autocorreccion&&lec.autocorreccion.trim())
    y=pdfDrawCard(doc,y,'AUTOCORRECCIÓN',PDF_C.red,lec.autocorreccion,meta,pc);
  const nota=getNotas(lec.id);
  if(nota)y=pdfDrawCard(doc,y,'MIS NOTAS',PDF_C.green,nota,meta,pc);
  return y;
}

function exportarPDFLeccion(){
  const lec=lecActual;if(!lec)return;
  try{
    const{jsPDF}=window.jspdf;
    const doc=new jsPDF({unit:'mm',format:'a4'});
    const meta={libro:libroActual?.titulo||'',autor:libroActual?.autor||'',eje:libroActual?.eje||''};
    const pc={n:1};
    pdfDrawChrome(doc,meta,1);
    pdfRenderLesson(doc,lec,meta,pc,null,null);
    doc.save(`SCS_${lec.titulo.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g,'').replace(/ +/g,'_').substring(0,50)}.pdf`);
    toast('PDF generado');
  }catch(e){toast('Error PDF: '+e.message);}
}

function exportarPDFLibro(){
  if(!libroActual){toast('Sin libro activo');return;}
  const lecsLib=lecs.filter(l=>l.libro_id===libroActual.id).sort((a,b)=>a.orden-b.orden);
  if(!lecsLib.length){toast('Sin lecciones');return;}
  try{
    const{jsPDF}=window.jspdf;
    const doc=new jsPDF({unit:'mm',format:'a4'});
    const meta={libro:libroActual.titulo,autor:libroActual.autor,eje:libroActual.eje||'',n:lecsLib.length};
    pdfDrawCover(doc,meta);
    const pc={n:1};
    lecsLib.forEach((lec,i)=>{
      doc.addPage();pc.n++;pdfDrawChrome(doc,meta,pc.n);
      pdfRenderLesson(doc,lec,meta,pc,i+1,lecsLib.length);
    });
    doc.save(`SCS_${libroActual.titulo.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g,'').replace(/ +/g,'_')}_completo.pdf`);
    toast(`PDF completo generado (${lecsLib.length} lecciones)`);
  }catch(e){toast('Error PDF: '+e.message);}
}

/* ═══════════════════════════════════════════
   CITAS
═══════════════════════════════════════════ */
async function verQuotes(){
  showView('quotes');
  const cont=document.getElementById('quotes-container');
  cont.innerHTML=`<div class="quotes-loading"><div class="quotes-loading-ring"></div><span>Cargando citas...</span></div>`;
  try{
    const citasData=await sb('lecciones?select=id,titulo,libro_id,cita_memorable&cita_memorable=not.is.null&cita_memorable=neq.&activa=eq.true&order=libro_id.asc');
    if(!citasData||!citasData.length){
      cont.innerHTML=`<div class="quotes-empty"><span class="quotes-empty-ico">💬</span><p>Aún no hay citas memorables en la base de datos.</p></div>`;
      return;
    }
    const favQ=favQuotes();
    const libroMap={};
    libros.forEach(l=>{libroMap[l.id]=l;});
    cont.innerHTML=`<div class="quotes-meta">${citasData.length} cita${citasData.length!==1?'s':''} en el corpus</div>`+
      citasData.map(lec=>{
        const libro=libroMap[lec.libro_id];
        const key=`cita-${lec.id}`;
        const on=favQ.includes(key);
        return `<div class="quote-card">
          <div class="quote-text">${esc(lec.cita_memorable)}</div>
          <div class="quote-attr">
            ${lec.titulo?`<span class="quote-attr-lec">${esc(lec.titulo)}</span>`:''}
            ${libro?`<span class="quote-attr-autor">${esc(libro.autor)} — ${esc(libro.titulo)}</span>`:''}
          </div>
          <button class="quote-fav-btn ${on?'on':''}" onclick="toggleFavQuote('${key}',this)">${on?'★':'☆'}</button>
        </div>`;
      }).join('');
  }catch(e){
    cont.innerHTML=`<div class="quotes-empty"><span class="quotes-empty-ico">⚠️</span><p>Error: ${esc(e.message)}</p></div>`;
  }
}

/* ═══════════════════════════════════════════
   FAVORITOS
═══════════════════════════════════════════ */
function renderFavoritos(){
  const fLib=favLibros(); const fLec=favLecs();
  const comp=completadasSet();
  const lCont=document.getElementById('fav-libros-cont');
  const lLbl=document.getElementById('fav-libros-lbl');
  lLbl.textContent=`Libros (${fLib.length})`;
  lCont.innerHTML=fLib.length
    ?fLib.map(id=>{
        const l=libros.find(x=>x.id===id);if(!l)return'';
        const lecsL=lecs.filter(x=>x.libro_id===id);
        const done=lecsL.filter(x=>comp.has(x.id)).length;
        const pct=lecsL.length?Math.round(done/lecsL.length*100):0;
        return `<div class="lec-item" onclick="verLibro('${id}')">
          <div class="lec-left"><div class="lec-title">${esc(l.titulo)}</div>
          <div class="lec-meta"><span class="lec-num">${esc(l.autor)}</span></div></div>
          <div class="lec-right">
            <span class="eje-tag ${ejeClass(l.eje)}">${esc(l.eje||'—')}</span>
            <span style="font-size:0.63rem;color:var(--text3);font-family:var(--font-mono)">${pct}%</span>
            <button class="fav-btn on" onclick="event.stopPropagation();toggleFavLib('${id}',this);renderFavoritos()">★</button>
          </div>
        </div>`;
      }).join('')
    :`<div class="fav-empty"><span class="fav-empty-ico">📚</span>Sin libros favoritos</div>`;
  const eCont=document.getElementById('fav-lecs-cont');
  const eLbl=document.getElementById('fav-lecs-lbl');
  eLbl.textContent=`Lecciones (${fLec.length})`;
  eCont.innerHTML=fLec.length
    ?fLec.map(id=>{
        const l=lecs.find(x=>x.id===id);if(!l)return'';
        const libro=libros.find(x=>x.id===l.libro_id);
        const done=comp.has(l.id);
        return `<div class="lec-item ${done?'done':''}" onclick="verLeccion('${id}','favoritos')">
          <div class="lec-left"><div class="lec-title">${esc(l.titulo)}</div>
          <div class="lec-meta"><span class="lec-num">${esc(libro?.titulo||'—')}</span></div></div>
          <div class="lec-right">
            <button class="fav-btn on" onclick="event.stopPropagation();toggleFavLec('${id}',this);renderFavoritos()">★</button>
            <span class="lec-status ${done?'ok':'no'}">${done?'✓':'○'}</span>
          </div>
        </div>`;
      }).join('')
    :`<div class="fav-empty"><span class="fav-empty-ico"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></span>Sin lecciones favoritas</div>`;
}

/* ═══════════════════════════════════════════
   TEST CONFIG MODAL
═══════════════════════════════════════════ */
let tcLibroId=null, tcEjeActivo=null, tcN=5;

function abrirTest(libroId=null){
  tcLibroId=libroId; tcEjeActivo=null; tcN=5;
  // Rellenar pills de eje
  const ejesDisp=[...new Set(preg.map(p=>{
    const l=libros.find(x=>x.id===p.libro_id); return l?.eje||null;
  }).filter(Boolean))].sort();
  const cont=document.getElementById('tconfig-ejes');
  cont.innerHTML=`<div class="tconfig-pill active" data-eje="" onclick="tcSelectEje(this)">Todos</div>`+
    ejesDisp.map(e=>`<div class="tconfig-pill" data-eje="${e}" onclick="tcSelectEje(this)">${ejeIcon(e)} ${e}</div>`).join('');
  // Reset num pills
  document.querySelectorAll('.tconfig-num').forEach(el=>el.classList.toggle('active',el.dataset.n==='5'));
  // Sub y info
  const sub=document.getElementById('tconfig-sub');
  if(libroId){
    const libro=libros.find(l=>l.id===libroId);
    sub.textContent=libro?`${libro.titulo} — ${libro.autor}`:'Libro seleccionado';
    // Si es test de libro, ocultar filtro de eje (label + pills)
    const ejeLabel=cont.previousElementSibling;
    cont.style.display='none';
    if(ejeLabel&&ejeLabel.classList.contains('tconfig-label')) ejeLabel.style.display='none';
  } else {
    sub.textContent='Todas las preguntas disponibles';
    const ejeLabel=cont.previousElementSibling;
    cont.style.display='';
    if(ejeLabel&&ejeLabel.classList.contains('tconfig-label')) ejeLabel.style.display='';
  }
  tcUpdateInfo();
  document.getElementById('tconfig-overlay').classList.remove('hidden');
}

function closeTconfig(){document.getElementById('tconfig-overlay').classList.add('hidden');}

function tcSelectEje(el){
  document.querySelectorAll('.tconfig-pill').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  tcEjeActivo=el.dataset.eje||null;
  tcUpdateInfo();
}

function tcSelectN(el){
  document.querySelectorAll('.tconfig-num').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  tcN=parseInt(el.dataset.n);
  tcUpdateInfo();
}

function tcGetPool(){
  let pool=tcLibroId?preg.filter(p=>p.libro_id===tcLibroId):[...preg];
  if(tcEjeActivo) pool=pool.filter(p=>{
    const l=libros.find(x=>x.id===p.libro_id); return l?.eje===tcEjeActivo;
  });
  return pool;
}

function tcUpdateInfo(){
  const pool=tcGetPool();
  // contar cuántas son "malas" (falladas)
  const mal=new Set(prog.filter(p=>p.tipo==='pregunta'&&p.resultado==='incorrecta').map(p=>p.item_id));
  const nMalas=pool.filter(p=>mal.has(p.id)).length;
  const nFinal=Math.min(tcN===999?pool.length:tcN, pool.length);
  const info=document.getElementById('tconfig-info');
  if(!pool.length){info.textContent='⚠ Sin preguntas para esta selección';return;}
  info.textContent=`${pool.length} preguntas disponibles · ${nMalas} con fallos previos · Se usarán ${nFinal}`;
}

function lanzarTest(){
  const pool=tcGetPool();
  if(!pool.length){toast('Sin preguntas disponibles');return;}
  closeTconfig();
  const mal=new Set(prog.filter(p=>p.tipo==='pregunta'&&p.resultado==='incorrecta').map(p=>p.item_id));
  const malas=pool.filter(p=>mal.has(p.id)).sort(()=>Math.random()-0.5);
  const resto=pool.filter(p=>!mal.has(p.id)).sort(()=>Math.random()-0.5);
  const n=tcN===999?pool.length:tcN;
  testPregs=[...malas,...resto].slice(0,Math.min(n,pool.length));
  testIdx=0;testResp=[];testCorr=0;testErr=0;
  showView('test');renderPregunta();
}

/* ═══════════════════════════════════════════
   TEST (entrada pública — abre modal)
═══════════════════════════════════════════ */
function iniciarTest(libroId=null){ abrirTest(libroId); }
function testDelLibro(id){ abrirTest(id); }

const LETRAS=['A','B','C','D'];
function difLabel(d){
  const map={1:'Básica',2:'Media',3:'Difícil'};
  const cls={1:'d1',2:'d2',3:'d3'};
  return `<span class="preg-dif ${cls[d]||'d1'}">${map[d]||'Básica'}</span>`;
}

function renderPregunta(){
  const p=testPregs[testIdx];
  const total=testPregs.length;
  document.getElementById('test-prog').style.width=`${(testIdx/total)*100}%`;
  document.getElementById('test-counter').textContent=`Pregunta ${testIdx+1} de ${total}`;
  document.getElementById('test-live-score').textContent=`✓ ${testCorr} · ✗ ${testErr}`;
  document.getElementById('btn-sig').style.display='none';
  const libro=libros.find(l=>l.id===p.libro_id);
  document.getElementById('preg-cont').innerHTML=`
    <div class="preg-card">
      <div class="preg-libro">${libro?`${esc(libro.titulo)} — ${esc(libro.autor)}`:esc(p.eje||'')}</div>
      ${difLabel(p.dificultad)}
      <div class="preg-txt">${esc(p.texto)}</div>
      <div class="opts-grid">
        ${(p.opciones||[]).map((op,i)=>`
          <button class="opt-btn" onclick="responder(${i})" data-idx="${i}">
            <span class="opt-letter">${LETRAS[i]||i}</span><span>${esc(op)}</span>
          </button>`).join('')}
      </div>
      <div id="feedback-p"></div>
    </div>`;
}

async function responder(idx){
  const p=testPregs[testIdx];
  if(idx<0||idx>=(p.opciones||[]).length)return;
  if(testResp.some(r=>r.p.id===p.id))return;
  const ok=idx===p.correcta;
  if(ok)testCorr++;else testErr++;
  document.getElementById('test-live-score').textContent=`✓ ${testCorr} · ✗ ${testErr}`;
  document.querySelectorAll('.opt-btn').forEach((btn,i)=>{
    btn.disabled=true;
    if(i===p.correcta)btn.classList.add('ok');
    else if(i===idx&&!ok)btn.classList.add('err');
  });
  document.getElementById('feedback-p').innerHTML=`
    <div class="feedback ${ok?'ok':'err'}">
      <div class="feedback-head">${ok?'✓ Correcto':'✗ Incorrecto'}</div>
      <div>${esc(p.explicacion||'')}</div>
    </div>`;
  testResp.push({p,resp:idx,ok});
  document.getElementById('btn-sig').style.display='block';
  try{
    await sb('progreso',{method:'POST',body:JSON.stringify({tipo:'pregunta',item_id:p.id,resultado:ok?'correcta':'incorrecta',fecha:new Date().toISOString()})});
    prog.push({tipo:'pregunta',item_id:p.id,resultado:ok?'correcta':'incorrecta',fecha:new Date().toISOString()});
  }catch(e){console.error(e);}
}

async function siguientePregunta(){
  testIdx++;
  if(testIdx>=testPregs.length)await finalizarTest();
  else renderPregunta();
}

async function finalizarTest(){
  const total=testResp.length;
  const ok=testResp.filter(r=>r.ok).length;
  const pct=total?Math.round(ok/total*100):0;
  try{await sb('sesiones',{method:'POST',body:JSON.stringify({total,correctas:ok,porcentaje:pct,fecha:new Date().toISOString()})});}catch{}
  const fallos=testResp.filter(r=>!r.ok);
  document.getElementById('res-cont').innerHTML=`
    <div class="res-card">
      <div style="font-size:0.73rem;color:var(--text3);font-family:var(--font-mono)">Resultado del test</div>
      <div class="res-pct">${pct}%</div>
      <div class="res-sub">${ok} de ${total} correctas</div>
      <div class="res-bars">
        <div class="res-bar-card"><div class="res-bar-num" style="color:var(--success)">${ok}</div><div class="res-bar-label">Correctas</div></div>
        <div class="res-bar-card"><div class="res-bar-num" style="color:var(--danger)">${total-ok}</div><div class="res-bar-label">Incorrectas</div></div>
        <div class="res-bar-card"><div class="res-bar-num">${total}</div><div class="res-bar-label">Total</div></div>
      </div>
      ${fallos.length?`<div class="fallos-list"><p class="sec-label">Para repasar (${fallos.length}):</p>${fallos.map(r=>`<div class="fallo-item">${esc(r.p.texto)}</div>`).join('')}</div>`:'<p style="color:var(--success);margin-top:1rem">🏆 ¡Test perfecto!</p>'}
      <div style="display:flex;gap:0.7rem;justify-content:center;margin-top:2rem">
        <button class="act-btn primary" onclick="iniciarTest()">Nuevo test</button>
        <button class="act-btn secondary" onclick="showView('home')">Inicio</button>
      </div>
    </div>`;
  showView('resultados');
}

/* ═══════════════════════════════════════════
   REPASO RÁPIDO
═══════════════════════════════════════════ */
async function comenzarRepasoRapido(){
  const comp=completadasSet();
  const fechas={};
  prog.filter(p=>p.tipo==='leccion').forEach(p=>{
    if(!fechas[p.item_id]||p.fecha>fechas[p.item_id])fechas[p.item_id]=p.fecha;
  });
  const arr=[...comp].sort((a,b)=>(fechas[a]||'')<(fechas[b]||'')?-1:1);
  repasoLecs=arr.slice(0,5).map(id=>lecs.find(l=>l.id===id)).filter(Boolean);
  if(repasoLecs.length<5){
    const rest=lecs.filter(l=>!comp.has(l.id)).slice(0,5-repasoLecs.length);
    repasoLecs=[...repasoLecs,...rest];
  }
  if(!repasoLecs.length){toast('Sin lecciones para repasar');return;}
  repasoIdx=0;showView('repaso');renderRepaso();
}

function renderRepaso(){
  const l=repasoLecs[repasoIdx];if(!l)return;
  const total=repasoLecs.length;
  document.getElementById('repaso-counter').textContent=`Lección ${repasoIdx+1} de ${total}`;
  document.getElementById('repaso-dots').innerHTML=Array.from({length:total},(_,i)=>
    `<div class="repaso-dot ${i<repasoIdx?'done':i===repasoIdx?'cur':''}"></div>`).join('');
  const comp=completadasSet();
  const done=comp.has(l.id);
  const libro=libros.find(x=>x.id===l.libro_id);
  let html='';
  if(libro)html+=`<div style="font-size:0.7rem;color:var(--text3);font-family:var(--font-mono);margin-bottom:0.6rem">${esc(libro.autor)} — ${esc(libro.titulo)}</div>`;
  if(l.imagen_principal)html+=`<div class="lec-img-wrap"><img src="${l.imagen_principal}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'"></div>`;
  html+=`<h2 class="lec-titulo">${esc(l.titulo)}</h2>`;
  html+=`<div class="lec-body fmt">${fmt(l.cuerpo)}</div>`;
  if(l.detalles?.length)html+=`<div class="det-grid">`+l.detalles.map(d=>`<div class="det-card"><div class="det-card-title">${esc(d.subtitulo||d.titulo||'')}</div><div class="fmt">${fmt(d.cuerpo||d.contenido||'')}</div></div>`).join('')+`</div>`;
  html+=`<div style="margin-top:1rem">
    ${!done?`<button class="act-btn primary" onclick="marcarCompletadaRepaso('${l.id}')">✓ Marcar completada</button>`:`<button class="act-btn done-mark" disabled>✓ Completada</button>`}
    <button class="act-btn secondary" style="margin-left:0.5rem" onclick="verLeccion('${l.id}','repaso')">Ver completa →</button>
  </div>`;
  document.getElementById('repaso-cont').innerHTML=html;
  document.getElementById('rp-prev').style.visibility=repasoIdx>0?'visible':'hidden';
  document.getElementById('rp-next').textContent=repasoIdx<repasoLecs.length-1?'Siguiente →':'Finalizar';
}

function repasoSiguiente(){if(repasoIdx<repasoLecs.length-1){repasoIdx++;renderRepaso();window.scrollTo(0,0);}else{toast('✓ Repaso completado');showView('home');}}
function repasoAnterior(){if(repasoIdx>0){repasoIdx--;renderRepaso();}}
async function marcarCompletadaRepaso(id){await marcarCompletada(id);renderRepaso();}

/* ═══════════════════════════════════════════
   LECCIÓN ALEATORIA
═══════════════════════════════════════════ */
function leccionAleatoria(){
  const comp=completadasSet();
  const pool=lecs.filter(l=>!comp.has(l.id));
  const src=pool.length?pool:lecs;
  if(!src.length){toast('Sin lecciones');return;}
  const l=src[Math.floor(Math.random()*src.length)];
  libroActual=libros.find(x=>x.id===l.libro_id);
  verLeccion(l.id);
}

/* ═══════════════════════════════════════════
   VISTA AUTOR
═══════════════════════════════════════════ */
function verAutor(enc){
  const autor=decodeURIComponent(enc);
  const list=lecs.filter(l=>l.autores_relacionados?.includes(autor));
  document.getElementById('autor-name').textContent=autor;
  document.getElementById('autor-count').textContent=`${list.length} lecciones relacionadas`;
  document.getElementById('back-autor-btn').onclick=()=>window.history.back();
  const comp=completadasSet();
  document.getElementById('autor-lecs-cont').innerHTML=list.length
    ?list.map(l=>{
        const libro=libros.find(x=>x.id===l.libro_id);
        const done=comp.has(l.id);
        return `<div class="lec-item ${done?'done':''}" onclick="verLeccion('${l.id}','autor')">
          <div class="lec-left"><div class="lec-title">${esc(l.titulo)}</div>
          <div class="lec-meta"><span class="lec-num">${esc(libro?.titulo||'—')}</span></div></div>
          <span class="lec-status ${done?'ok':'no'}">${done?'✓':'○'}</span>
        </div>`;
      }).join('')
    :`<div class="empty">Sin lecciones para este autor</div>`;
  showView('autor');
}

/* ═══════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════ */
function showView(name, skipPush=false){
  if(name!=='leccion'){if(ttsAudio){ttsAudio.pause();ttsAudio=null;}if(window.speechSynthesis){speechSynthesis.cancel();}ttsUtterance=null;ttsPaused=false;ttsMode=null;ttsAudioUrl=null;}
  document.body.classList.toggle('noche', name==='cuaderno');
  Lectura.apply(name);
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(`view-${name}`)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const topMap={home:'nav-home',favoritos:'nav-favoritos',test:'nav-test',resultados:'nav-test',esquemas:'nav-esquemas','esquema-viewer':'nav-esquemas',busqueda:'nav-busqueda',ensayos:'nav-ensayos','ensayo-detalle':'nav-ensayos','repaso-srs':'nav-repaso-srs'};
  if(topMap[name])document.getElementById(topMap[name])?.classList.add('active');
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('active'));
  const botMap={home:'bnav-home',favoritos:'bnav-favoritos',test:'bnav-test',resultados:'bnav-test',esquemas:'bnav-esquemas','esquema-viewer':'bnav-esquemas',busqueda:'bnav-busqueda',ensayos:'bnav-ensayos','ensayo-detalle':'bnav-ensayos','repaso-srs':'bnav-repaso-srs'};
  if(botMap[name])document.getElementById(botMap[name])?.classList.add('active');
  window.scrollTo(0,0);
  if(!skipPush){
    const state={view:name,libroId:libroActual?.id||null,lecId:lecActual?.id||null};
    let hash=`#${name}`;
    if(name==='leccion'&&lecActual) hash=`#leccion/${lecActual.libro_id}/${lecActual.id}`;
    if(name==='cuaderno'&&lecActual) hash=`#cuaderno/${lecActual.libro_id}/${lecActual.id}`;
    if(name==='lecciones'&&libroActual) hash=`#lecciones/${libroActual.id}`;
    history.pushState(state,'',hash);
  }
  if(name==='home'){paginaActual=1;document.getElementById('search-results-lecs').style.display='none';renderStats();renderLibros();renderContinua();renderUltimosLibros();}
  if(name==='favoritos')renderFavoritos();
  if(name==='ensayos')renderEnsayos();
  if(name==='busqueda'){ setTimeout(()=>{ const i=document.getElementById('corpus-search-input'); if(i)i.focus(); },100); }
  if(name==='repaso-srs')initSRS();
  if(name==='leccion'||name==='cuaderno') Ambiente.syncBtn();
}

/* ═══════════════════════════════════════════
   BÚSQUEDA FULL-TEXT (RPC buscar_corpus)
═══════════════════════════════════════════ */
let corpusSearchTimer = null;

function onCorpusSearch(val) {
  const clr = document.getElementById('corpus-search-clear');
  if (clr) clr.classList.toggle('vis', val.length > 0);
  clearTimeout(corpusSearchTimer);
  if (!val.trim()) {
    document.getElementById('corpus-search-estado').textContent = 'Escribe un término para buscar en el corpus';
    document.getElementById('corpus-search-results').innerHTML = '';
    return;
  }
  document.getElementById('corpus-search-estado').textContent = 'Buscando...';
  corpusSearchTimer = setTimeout(() => ejecutarCorpusSearch(val.trim()), 400);
}

async function ejecutarCorpusSearch(termino) {
  const estado = document.getElementById('corpus-search-estado');
  const cont = document.getElementById('corpus-search-results');
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/buscar_corpus`, {
      method: 'POST',
      headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ termino, limite: 15 })
    });
    const data = await r.json();
    if (!data || !data.length) {
      estado.textContent = `Sin resultados para "${termino}"`;
      cont.innerHTML = '<div class="empty">No se encontraron lecciones con ese término.</div>';
      return;
    }
    estado.textContent = `${data.length} resultado${data.length !== 1 ? 's' : ''} para "${termino}"`;
    cont.innerHTML = data.map(item => {
      const fragmento = esc(item.fragmento||'').replace(/\*\*([^*]+)\*\*/g, '<mark class="hl">$1</mark>');
      return `
        <div class="corpus-result-item" onclick="irALeccionDesdeCorpus('${item.leccion_id}')">
          <div class="corpus-result-header">
            <span class="corpus-result-titulo">${esc(item.leccion_titulo)}</span>
          </div>
          <div class="corpus-result-libro">${esc(item.libro_titulo)} — <em>${esc(item.libro_autor)}</em></div>
          <div class="corpus-result-fragmento">${fragmento}</div>
        </div>
      `;
    }).join('');
  } catch(e) {
    estado.textContent = 'Error en la búsqueda';
    cont.innerHTML = '';
    console.error(e);
  }
}

function clearCorpusSearch() {
  const i = document.getElementById('corpus-search-input');
  if (i) { i.value = ''; onCorpusSearch(''); }
}

function irALeccionDesdeCorpus(leccionId) {
  const lec = lecs.find(l => l.id === leccionId);
  if (!lec) { toast('Lección no encontrada en caché'); return; }
  verLeccion(lec.id);
}

/* ═══════════════════════════════════════════
   ENSAYOS DE SÍNTESIS
═══════════════════════════════════════════ */
let ensayosCache = [];

async function renderEnsayos() {
  const grid = document.getElementById('ensayos-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="skeleton sk-card"></div><div class="skeleton sk-card"></div>';
  try {
    if (!ensayosCache.length) {
      const r = await fetch(`${SB_URL}/rest/v1/articulos?select=*&order=created_at.desc`, {
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
      });
      ensayosCache = await r.json();
    }
    if (!ensayosCache.length) {
      grid.innerHTML = '<div class="empty">No hay ensayos disponibles todavía.</div>';
      return;
    }
    grid.innerHTML = ensayosCache.map(a => `
      <div class="ensayo-card" onclick="verEnsayo('${a.id}')">
        <div class="ensayo-card-header">
          <h2 class="ensayo-card-titulo">${esc(a.titulo)}</h2>
          <p class="ensayo-card-pregunta">${esc(a.pregunta_generadora)}</p>
        </div>
        <div class="ensayo-card-footer">
          <div class="ensayo-autores">
            ${(a.autores_convocados||[]).map(au=>`<span class="ensayo-autor-badge">${esc(au)}</span>`).join('')}
          </div>
          <span class="ensayo-meta">${(a.autores_convocados||[]).length} autores</span>
        </div>
      </div>
    `).join('');
  } catch(e) {
    grid.innerHTML = '<div class="empty">Error cargando ensayos.</div>';
    console.error(e);
  }
}

function nl2br(s){ return (s||'').split('\n').join('<br>'); }

function verEnsayo(id) {
  const a = ensayosCache.find(x => x.id === id);
  if (!a) return;
  const cont = document.getElementById('ensayo-contenido');
  cont.innerHTML = `
    <div class="ensayo-detail">
      <div class="ensayo-pregunta-hero">
        <span class="ensayo-pregunta-label">Pregunta generadora</span>
        <h1 class="ensayo-detail-titulo">${esc(a.titulo)}</h1>
        <p class="ensayo-detail-pregunta">${esc(a.pregunta_generadora)}</p>
        <div class="ensayo-autores" style="margin-top:1rem">
          ${(a.autores_convocados||[]).map(au=>`<span class="ensayo-autor-badge clickable" data-autor="${esc(au)}" onclick="filtrarPorAutorDesdeEnsayo(this.dataset.autor)" title="Ver libros de ${esc(au)}">${esc(au)}</span>`).join('')}
        </div>
      </div>
      <div class="ensayo-section expanded">
        <div class="ensayo-section-header" onclick="toggleEnsayoSection(this)">
          <span><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> Ensayo</span><span class="ensayo-toggle">▲</span>
        </div>
        <div class="ensayo-section-body">
          <div class="ensayo-body-text">${(a.cuerpo||'').replace(/\n/g,'<br>')}</div>
        </div>
      </div>
      <div class="ensayo-section">
        <div class="ensayo-section-header" onclick="toggleEnsayoSection(this)">
          <span>🤝 Convergencias</span><span class="ensayo-toggle">▼</span>
        </div>
        <div class="ensayo-section-body" style="display:none">
          <div class="ensayo-body-text">${(a.convergencias||'—').replace(/\n/g,'<br>')}</div>
        </div>
      </div>
      <div class="ensayo-section">
        <div class="ensayo-section-header" onclick="toggleEnsayoSection(this)">
          <span>⚡ Divergencias</span><span class="ensayo-toggle">▼</span>
        </div>
        <div class="ensayo-section-body" style="display:none">
          <div class="ensayo-body-text">${(a.divergencias||'—').replace(/\n/g,'<br>')}</div>
        </div>
      </div>
      <div class="ensayo-section ensayo-sintesis">
        <div class="ensayo-section-header" onclick="toggleEnsayoSection(this)">
          <span>💎 Síntesis Original</span><span class="ensayo-toggle">▼</span>
        </div>
        <div class="ensayo-section-body" style="display:none">
          <div class="ensayo-sintesis-nota">Esta síntesis es tu elaboración personal — no la de los autores</div>
          <div class="ensayo-body-text">${(a.sintesis_original||'—').replace(/\n/g,'<br>')}</div>
        </div>
      </div>
      <div class="ensayo-section">
        <div class="ensayo-section-header" onclick="toggleEnsayoSection(this)">
          <span>🎯 Aplicación Práctica</span><span class="ensayo-toggle">▼</span>
        </div>
        <div class="ensayo-section-body" style="display:none">
          <div class="ensayo-body-text">${(a.aplicacion||'—').replace(/\n/g,'<br>')}</div>
        </div>
      </div>
    </div>
  `;
  showView('ensayo-detalle');
}

function toggleEnsayoSection(hdr) {
  const section = hdr.closest('.ensayo-section');
  const body = section.querySelector('.ensayo-section-body');
  const toggle = hdr.querySelector('.ensayo-toggle');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  toggle.textContent = open ? '▼' : '▲';
  section.classList.toggle('expanded', !open);
}

function filtrarPorAutorDesdeEnsayo(autor) {
  ejeActivo = null; subEjeActivo = null; searchQ = '';
  const input = document.getElementById('search-input');
  if (input) { input.value = autor; }
  showView('home');
  setTimeout(() => onSearch(autor), 100);
  toast(`Filtrando libros de ${autor}`);
}

/* ═══════════════════════════════════════════
   SPACED REPETITION SYSTEM (SRS)
═══════════════════════════════════════════ */
const SRS_USER = 'default';
let srsEstado = null;
let srsCola = [];
let srsIdx = 0;
let srsModo = 'mixto';
let srsResumen = { correcto:0, fallo:0, pendiente:0, en_proceso:0, integrado:0 };

async function srsRPC(fn, body) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function initSRS() {
  if (srsSkipDash) { srsSkipDash = false; return; }
  renderSRSDashboard();
  try {
    srsEstado = await srsRPC('estado_repaso', { p_usuario: SRS_USER });
    renderSRSDashboard();
  } catch(e) { console.error('SRS estado error:', e); }
}

function renderSRSDashboard() {
  const root = document.getElementById('srs-root');
  if (!root) return;
  const e = srsEstado;
  const pendHoy = e ? (e[0]?.pendientes_hoy ?? '—') : '...';
  const totalItems = e ? (e[0]?.total_items ?? '—') : '...';
  const librosActivos = e ? (e[0]?.libros_activos ?? '—') : '...';
  const n1 = e ? (e[0]?.nivel_1 ?? 0) : 0;
  const n2 = e ? (e[0]?.nivel_2 ?? 0) : 0;
  const n3 = e ? (e[0]?.nivel_3 ?? 0) : 0;
  const n4 = e ? (e[0]?.nivel_4 ?? 0) : 0;
  const total = n1+n2+n3+n4 || 1;
  root.innerHTML = `
    <h1 class="page-title" style="margin-bottom:0.3rem">🔁 Repaso Espaciado</h1>
    <p class="page-sub" style="margin-bottom:1.8rem">Retrieval practice + reflexión personal</p>
    <div class="srs-stats-grid">
      <div class="srs-stat"><div class="srs-stat-num" style="color:var(--accent)">${pendHoy}</div><div class="srs-stat-lbl">Pendientes hoy</div></div>
      <div class="srs-stat"><div class="srs-stat-num">${totalItems}</div><div class="srs-stat-lbl">Total en cola</div></div>
      <div class="srs-stat"><div class="srs-stat-num" style="color:var(--success)">${librosActivos}</div><div class="srs-stat-lbl">Libros activos</div></div>
    </div>
    <div class="srs-niveles">
      <p class="sec-label" style="margin-bottom:0.8rem">Distribución por nivel</p>
      <div class="srs-nivel-row"><span class="srs-nivel-lbl">Nivel 1</span><div class="srs-nivel-bar"><div class="srs-nivel-fill" style="width:${Math.round(n1/total*100)}%;background:#e74c3c"></div></div><span class="srs-nivel-count">${n1}</span></div>
      <div class="srs-nivel-row"><span class="srs-nivel-lbl">Nivel 2</span><div class="srs-nivel-bar"><div class="srs-nivel-fill" style="width:${Math.round(n2/total*100)}%;background:#e67e22"></div></div><span class="srs-nivel-count">${n2}</span></div>
      <div class="srs-nivel-row"><span class="srs-nivel-lbl">Nivel 3</span><div class="srs-nivel-bar"><div class="srs-nivel-fill" style="width:${Math.round(n3/total*100)}%;background:#f1c40f"></div></div><span class="srs-nivel-count">${n3}</span></div>
      <div class="srs-nivel-row"><span class="srs-nivel-lbl">Nivel 4</span><div class="srs-nivel-bar"><div class="srs-nivel-fill" style="width:${Math.round(n4/total*100)}%;background:#2ecc71"></div></div><span class="srs-nivel-count">${n4}</span></div>
    </div>
    <div class="srs-modo-section">
      <p class="sec-label" style="margin-bottom:0.8rem">Modo de sesión</p>
      <div class="srs-modo-row">
        <button class="srs-modo-btn ${srsModo==='quiz'?'active':''}" onclick="srsSetModo('quiz')"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg> Quiz<br><small>Retrieval practice</small></button>
        <button class="srs-modo-btn ${srsModo==='reflexion'?'active':''}" onclick="srsSetModo('reflexion')">💭 Reflexión<br><small>Honor system</small></button>
        <button class="srs-modo-btn ${srsModo==='mixto'?'active':''}" onclick="srsSetModo('mixto')">🔀 Mixto<br><small>Ambos modos</small></button>
      </div>
    </div>
    <div style="display:flex;gap:0.7rem;margin-bottom:2rem;flex-wrap:wrap">
      <button class="act-btn primary" onclick="iniciarSesionSRS()">▶ Iniciar sesión</button>
      <button class="act-btn secondary" onclick="renderSRSActivacion()">📚 Activar libros</button>
    </div>
  `;
}

function srsSetModo(m) { srsModo = m; renderSRSDashboard(); }

async function renderSRSActivacion() {
  const root = document.getElementById('srs-root');
  root.innerHTML = `
    <button class="back-btn" onclick="renderSRSDashboard()">← Dashboard</button>
    <h2 style="font-family:var(--font-display);font-size:1.3rem;margin-bottom:0.5rem">📚 Activar libros para repaso</h2>
    <p style="font-size:0.78rem;color:var(--text2);margin-bottom:1.4rem">Activa un libro para añadir sus preguntas y lecciones a tu cola de repaso.</p>
    <div id="srs-activacion-lista"></div>
  `;
  document.getElementById('srs-activacion-lista').innerHTML = libros.map(l => `
    <div class="srs-activar-row">
      <div><div class="srs-activar-titulo">${l.titulo}</div><div class="srs-activar-autor">${l.autor}</div></div>
      <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
        <label style="font-size:0.65rem;color:var(--text3);font-family:var(--font-mono);display:flex;align-items:center;gap:0.3rem">
          <input type="checkbox" id="srs-quiz-${l.id}" checked style="accent-color:var(--accent)"> Quiz
        </label>
        <label style="font-size:0.65rem;color:var(--text3);font-family:var(--font-mono);display:flex;align-items:center;gap:0.3rem">
          <input type="checkbox" id="srs-ref-${l.id}" checked style="accent-color:var(--accent)"> Reflexión
        </label>
        <button class="act-btn primary" style="font-size:0.7rem;padding:0.35rem 0.8rem" data-libro-id="${l.id}" data-libro-titulo="${(l.titulo||'').replace(/"/g,'&quot;').replace(/</g,'&lt;')}" onclick="activarLibroSRS(this.dataset.libroId,this.dataset.libroTitulo,this)">Activar</button>
      </div>
    </div>
  `).join('');
}

async function activarLibroSRS(libroId, titulo, btn) {
  btn.disabled = true; btn.textContent = '⏳';
  try {
    const incQuiz = document.getElementById(`srs-quiz-${libroId}`)?.checked ?? true;
    const incRef = document.getElementById(`srs-ref-${libroId}`)?.checked ?? true;
    const res = await srsRPC('activar_libro_repaso', { p_libro_id: libroId, p_usuario: SRS_USER, p_incluir_quiz: incQuiz, p_incluir_reflexion: incRef });
    btn.textContent = '✓'; btn.style.background = 'var(--success)';
    toast(`✓ ${titulo}: +${res[0]?.quiz_añadidas||0} quiz, +${res[0]?.reflexiones_añadidas||0} reflexiones`);
  } catch(e) { btn.disabled = false; btn.textContent = 'Activar'; toast('Error: ' + e.message); }
}

async function iniciarSesionSRS() {
  const root = document.getElementById('srs-root');
  root.innerHTML = '<div class="empty">Cargando cola...</div>';
  try {
    srsCola = await srsRPC('obtener_cola_repaso', { p_usuario: SRS_USER, p_modo: srsModo, p_limite: srsLimiteSesion || 20 });
    srsLimiteSesion = 20;
    if (!srsCola || !srsCola.length) {
      root.innerHTML = `<button class="back-btn" onclick="renderSRSDashboard()">← Dashboard</button>
        <div class="empty" style="margin-top:2rem"><span style="font-size:2rem;display:block;margin-bottom:0.8rem">🎉</span>
        No hay items pendientes hoy en modo <strong>${srsModo}</strong>.<br><br>
        <button class="act-btn secondary" onclick="renderSRSActivacion()">Activar más libros</button></div>`;
      return;
    }
    srsIdx = 0;
    srsResumen = { correcto:0, fallo:0, pendiente:0, en_proceso:0, integrado:0 };
    renderSRSItem();
  } catch(e) { root.innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`; }
}

function renderSRSItem() {
  const root = document.getElementById('srs-root');
  if (srsIdx >= srsCola.length) { renderSRSFin(); return; }
  const item = srsCola[srsIdx];
  const pct = Math.round((srsIdx / srsCola.length) * 100);
  const bar = `<div style="height:3px;background:var(--border);border-radius:2px;margin-bottom:0.6rem">
    <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--accent-dim),var(--accent));border-radius:2px;transition:width 0.3s"></div></div>
    <div style="display:flex;justify-content:space-between;font-size:0.65rem;color:var(--text3);font-family:var(--font-mono);margin-bottom:1.2rem">
      <span>${srsIdx+1} de ${srsCola.length}</span><span>${pct}% completado</span></div>`;
  if (item.modo === 'quiz') {
    const opts = item.opciones || [];
    root.innerHTML = `<button class="back-btn" onclick="renderSRSDashboard()">← Salir</button>${bar}
      <div class="srs-modo-tag quiz"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg> Quiz — Nivel ${item.nivel||0}</div>
      <div class="srs-contexto">${item.libro_titulo} · <em>${item.libro_autor}</em></div>
      <div class="preg-card">
        <div class="preg-txt">${item.pregunta_texto}</div>
        <div class="opts-grid" id="srs-opts">
          ${opts.map((o,i)=>`<button class="opt-btn" onclick="srsResponderQuiz(${i},${item.correcta},'${item.repaso_id}')"><span class="opt-letter">${['A','B','C','D'][i]}</span>${o}</button>`).join('')}
        </div>
      </div>
      <div id="srs-feedback" style="display:none"></div>
      <div style="margin-top:1rem;display:none" id="srs-sig-btn"><button class="act-btn primary" onclick="srsIdx++;renderSRSItem()">Siguiente →</button></div>`;
  } else {
    root.innerHTML = `<button class="back-btn" onclick="renderSRSDashboard()">← Salir</button>${bar}
      <div class="srs-modo-tag reflexion">💭 Reflexión — Nivel ${item.nivel||0}</div>
      <div class="srs-contexto">${item.libro_titulo} · <em>${item.libro_autor}</em></div>
      <div class="preg-card">
        <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;margin-bottom:1rem">${item.leccion_titulo}</div>
        <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);font-family:var(--font-mono);margin-bottom:0.5rem">Aplicación práctica</div>
        <div style="font-size:0.92rem;line-height:var(--lh-relaxed);color:var(--text2);margin-bottom:1.2rem">${item.aplicacion_practica||''}</div>
        ${item.autocorreccion?`<details style="margin-top:0.5rem"><summary style="font-size:0.72rem;color:var(--text3);cursor:pointer;font-family:var(--font-mono)">↕ Ver matiz / contrapunto</summary>
        <div style="font-size:0.82rem;color:var(--text3);line-height:var(--lh-relaxed);padding:0.8rem;background:var(--surface2);border-radius:var(--radius);border:1px solid var(--border);margin-top:0.5rem">${item.autocorreccion}</div></details>`:''}
      </div>
      <p style="font-size:0.68rem;color:var(--text3);font-family:var(--font-mono);margin-bottom:0.8rem;line-height:1.5">Evalúa si has pensado seriamente sobre esto y formado tu propio criterio — no si sigues al autor.</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.6rem">
        <button class="srs-eval-btn pendiente" onclick="srsResponderReflexion('${item.repaso_id}','pendiente')">⬜ Pendiente<br><small>No he reflexionado</small></button>
        <button class="srs-eval-btn en-proceso" onclick="srsResponderReflexion('${item.repaso_id}','en_proceso')">🟠 En proceso<br><small>Entiendo, no aplico</small></button>
        <button class="srs-eval-btn integrado" onclick="srsResponderReflexion('${item.repaso_id}','integrado')">✅ Integrado<br><small>Tengo mi posición</small></button>
      </div>`;
  }
}

async function srsResponderQuiz(idx, correcta, repasoId) {
  const btns = document.querySelectorAll('#srs-opts .opt-btn');
  btns.forEach(b => b.disabled = true);
  const ok = idx === correcta;
  btns[idx].classList.add(ok ? 'ok' : 'err');
  if (!ok) btns[correcta].classList.add('ok');
  if (ok) srsResumen.correcto++; else srsResumen.fallo++;
  const item = srsCola[srsIdx];
  const fb = document.getElementById('srs-feedback');
  fb.style.display = 'block';
  fb.className = `feedback ${ok?'ok':'err'}`;
  fb.innerHTML = `<div class="feedback-head">${ok?'✓ Correcto':'✗ Incorrecto'}</div>${esc(item.explicacion||'')}`;
  document.getElementById('srs-sig-btn').style.display = 'block';
  try { await srsRPC('registrar_repaso', { p_repaso_id: repasoId, p_evaluacion: ok?'correcto':'fallo' }); } catch(e){}
}

async function srsResponderReflexion(repasoId, evaluacion) {
  document.querySelectorAll('.srs-eval-btn').forEach(b => b.disabled = true);
  srsResumen[evaluacion] = (srsResumen[evaluacion]||0) + 1;
  try { await srsRPC('registrar_repaso', { p_repaso_id: repasoId, p_evaluacion: evaluacion }); } catch(e){}
  setTimeout(() => { srsIdx++; renderSRSItem(); }, 300);
}

function renderSRSFin() {
  const root = document.getElementById('srs-root');
  const r = srsResumen; const total = srsCola.length;
  root.innerHTML = `<div style="text-align:center;padding:2rem 1rem">
    <div style="font-size:3rem;margin-bottom:1rem">🎉</div>
    <h2 style="font-family:var(--font-display);font-size:1.6rem;margin-bottom:0.4rem">Sesión completada</h2>
    <p style="font-size:0.82rem;color:var(--text2);margin-bottom:2rem">Has revisado ${total} item${total!==1?'s':''} hoy</p>
    <div class="srs-stats-grid" style="margin-bottom:2rem">
      ${r.correcto?`<div class="srs-stat"><div class="srs-stat-num" style="color:var(--success)">${r.correcto}</div><div class="srs-stat-lbl">Correctas</div></div>`:''}
      ${r.fallo?`<div class="srs-stat"><div class="srs-stat-num" style="color:var(--danger)">${r.fallo}</div><div class="srs-stat-lbl">Falladas</div></div>`:''}
      ${r.integrado?`<div class="srs-stat"><div class="srs-stat-num" style="color:var(--success)">${r.integrado}</div><div class="srs-stat-lbl">Integradas</div></div>`:''}
      ${r.en_proceso?`<div class="srs-stat"><div class="srs-stat-num" style="color:var(--des)">${r.en_proceso}</div><div class="srs-stat-lbl">En proceso</div></div>`:''}
      ${r.pendiente?`<div class="srs-stat"><div class="srs-stat-num" style="color:var(--text3)">${r.pendiente}</div><div class="srs-stat-lbl">Pendientes</div></div>`:''}
    </div>
    <p style="font-size:0.7rem;color:var(--text3);font-family:var(--font-mono);margin-bottom:1.5rem">Próxima revisión: mañana</p>
    <button class="act-btn primary" onclick="renderSRSDashboard()">← Volver al dashboard</button>
  </div>`;
}

window.addEventListener('popstate', e => {
  const state = e.state;
  const hash = window.location.hash.slice(1);
  if(!state && !hash){ showView('home', true); return; }
  if(!state && hash){ restoreFromURL(); return; }
  const {view, libroId, lecId} = state;
  if(libroId) libroActual = libros.find(l=>l.id===libroId)||libroActual;
  if(lecId)   lecActual   = lecs.find(l=>l.id===lecId)||lecActual;
  if(view==='lecciones' && libroActual){ renderLibroHero(); renderLecs(lecs.filter(l=>l.libro_id===libroActual.id)); showView(view, true); return; }
  if(view==='leccion'   && lecActual)  { verLeccion(lecActual.id, null); return; }
  showView(view, true);
});

/* ═══════════════════════════════════════════
   TOAST
═══════════════════════════════════════════ */
let toastT;
function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg;el.classList.add('show');
  clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),2800);
}

/* ═══════════════════════════════════════════
   URL — RESTAURACIÓN Y COMPARTIR
═══════════════════════════════════════════ */
function restoreFromURL(){
  const params=new URLSearchParams(window.location.search);
  const hash=window.location.hash.slice(1);

  // Formato query params legacy: ?vista=leccion&libro=UUID&leccion=UUID
  const vista=params.get('vista');
  if(vista){
    const libroId=params.get('libro');
    const lecId=params.get('leccion');
    if(libroId) libroActual=libros.find(l=>l.id===libroId)||null;
    if(lecId)   lecActual=lecs.find(l=>l.id===lecId)||null;
    if(vista==='leccion'&&lecActual){ verLeccion(lecActual.id); return; }
    if(vista==='lecciones'&&libroActual){ verLibro(libroActual.id); return; }
    showView(vista,true); return;
  }

  if(!hash||hash==='home') return;

  if(hash.startsWith('cuaderno/')){
    const parts=hash.split('/');
    const libroId=parts[1]; const lecId=parts[2];
    if(libroId) libroActual=libros.find(l=>l.id===libroId)||null;
    if(lecId){ abrirCuaderno(lecId); return; }
  }

  // Formato: #leccion/LIBRO_ID/LEC_ID
  if(hash.startsWith('leccion/')){
    const parts=hash.split('/');
    const libroId=parts[1]; const lecId=parts[2];
    if(libroId) libroActual=libros.find(l=>l.id===libroId)||null;
    if(lecId){
      lecActual=lecs.find(l=>l.id===lecId)||null;
      if(lecActual){ verLeccion(lecActual.id); return; }
    }
  }

  // Formato: #lecciones/LIBRO_ID
  if(hash.startsWith('lecciones/')){
    const libroId=hash.split('/')[1];
    if(libroId){
      libroActual=libros.find(l=>l.id===libroId)||null;
      if(libroActual){ verLibro(libroActual.id); return; }
    }
  }

  // Formato simple: #quotes, #favoritos, #esquemas
  const viewName=hash.split('/')[0];
  const validViews=['home','favoritos','quotes','esquemas','repaso','test','ensayos','repaso-srs','busqueda'];
  if(validViews.includes(viewName)) showView(viewName,true);
}

function compartirLeccion(){
  if(!lecActual) return;
  const base=window.location.origin+window.location.pathname;
  const url=`${base}#leccion/${lecActual.libro_id}/${lecActual.id}`;
  if(navigator.clipboard){
    navigator.clipboard.writeText(url).then(()=>toast('🔗 Enlace copiado'));
  } else {
    // fallback para navegadores sin clipboard API
    const ta=document.createElement('textarea');
    ta.value=url; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    toast('🔗 Enlace copiado');
  }
}

function compartirLibro(){
  if(!libroActual) return;
  const base=window.location.origin+window.location.pathname;
  const url=`${base}#lecciones/${libroActual.id}`;
  if(navigator.clipboard){
    navigator.clipboard.writeText(url).then(()=>toast('🔗 Enlace copiado'));
  } else {
    const ta=document.createElement('textarea');
    ta.value=url; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    toast('🔗 Enlace copiado');
  }
}

/* START */
init();



/* ═══════════════════════════════════════════
   SPOTLIGHT SEARCH (APPLE STYLE)
═══════════════════════════════════════════ */
function toggleSpotlight() {
  const overlay = document.getElementById('spotlight-overlay');
  const input = document.getElementById('spotlight-input');
  if (!overlay || !input) { showView('home'); document.getElementById('search-input')?.focus(); return; }
  if (overlay.classList.contains('hidden')) {
    overlay.classList.remove('hidden');
    input.value = '';
    document.getElementById('spotlight-state').style.display = 'block';
    document.getElementById('spotlight-results').innerHTML = '';
    setTimeout(() => input.focus(), 100);
  } else {
    overlay.classList.add('hidden');
    input.blur();
  }
}

document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    toggleSpotlight();
  }
  if (e.key === 'Escape') {
    const sp = document.getElementById('spotlight-overlay');
    if (sp && !sp.classList.contains('hidden')) toggleSpotlight();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const sInput = document.getElementById('spotlight-input');
  if(sInput) {
    sInput.addEventListener('input', (e) => onSpotlightSearch(e.target.value));
  }
});

function onSpotlightSearch(v) {
  const state = document.getElementById('spotlight-state');
  const resCont = document.getElementById('spotlight-results');
  const q = v.trim().toLowerCase();
  
  if (!q || q.length < 2) {
    state.style.display = 'block';
    state.textContent = q ? 'Escribe más para buscar...' : 'Escribe para explorar Mente fría';
    resCont.innerHTML = '';
    return;
  }
  state.style.display = 'none';
  
  // Buscar en libros y lecciones simultáneamente
  const relLibros = libros.filter(l => l.titulo.toLowerCase().includes(q) || l.autor.toLowerCase().includes(q)).slice(0,3);
  const relLecs = lecs.filter(l => l.titulo?.toLowerCase().includes(q) || l.cuerpo?.toLowerCase().includes(q)).slice(0, 6);

  let html = '';
  if(!relLibros.length && !relLecs.length) {
    state.style.display = 'block';
    state.textContent = 'Ningún resultado encontrado en el corpus.';
    resCont.innerHTML = '';
    return;
  }

  if (relLibros.length > 0) {
    html += `<div style="padding:0.5rem 1.5rem; font-size:0.65rem; color:var(--accent); text-transform:uppercase; letter-spacing:0.1em; opacity:0.8">Libros Relevantes</div>`;
    html += relLibros.map(l => {
      return `<div class="sp-result-item" onclick="toggleSpotlight(); verLibro('${l.id}')">
        <div class="sp-result-title">${hl(l.titulo, q)}</div>
        <div class="sp-result-meta">${hl(l.autor, q)} · ${esc(l.eje || 'Sin eje')}</div>
      </div>`;
    }).join('');
  }

  if (relLecs.length > 0) {
    html += `<div style="padding:0.5rem 1.5rem; font-size:0.65rem; color:var(--accent); text-transform:uppercase; letter-spacing:0.1em; opacity:0.8; margin-top:0.5rem;">Lecciones y Conceptos</div>`;
    const libroMap = {}; libros.forEach(lx=>libroMap[lx.id]=lx);
    html += relLecs.map(l => {
      const libro = libroMap[l.libro_id];
      const textoBase = l.cuerpo || '';
      const idx = textoBase.toLowerCase().indexOf(q);
      const raw = idx >= 0 ? textoBase.slice(Math.max(0, idx - 100), idx + 250) : '';
      const snippet = raw ? '...' + esc(raw).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi'), '<mark class="hl">$1</mark>') + '...' : '';

      return `<div class="sp-result-item" onclick="toggleSpotlight(); verLeccion('${l.id}')">
        <div class="sp-result-title">${hl(l.titulo, q)}</div>
        <div class="sp-result-meta">${libro ? esc(libro.titulo) : ''} ${libro ? '· '+esc(libro.autor) : ''}</div>
        ${snippet ? `<div class="sp-result-snippet">${snippet}</div>` : ''}
      </div>`;
    }).join('');
  }
  
  resCont.innerHTML = html;
}
