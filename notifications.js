/* ═══════════════════════════════════════════
   NOTIFICATION SYSTEM v2
   - Fixed: uses SB_URL/SB_KEY (not SUPABASE_URL/SUPABASE_KEY)
   - Centro funcional con filtros y fecha agrupada
   - Push notifications reales con Notification API
   - Achievement toasts con animaciones y partículas
   - Polling inteligente con visibility API
═══════════════════════════════════════════ */

let notifCache = [];
let notifPanelOpen = false;
let lastNotifCheck = 0;
let currentFilter = 'all';
let notifAchievementQueue = [];
let isShowingAchievement = false;

/* ── PANEL TOGGLE ── */
function toggleNotifPanel() {
  notifPanelOpen = !notifPanelOpen;
  document.getElementById('notif-panel').classList.toggle('open', notifPanelOpen);
  document.getElementById('notif-overlay').classList.toggle('open', notifPanelOpen);
  if (notifPanelOpen) {
    loadNotifications();
    checkPushPermission();
  }
  // Prevent body scroll when panel is open
  document.body.style.overflow = notifPanelOpen ? 'hidden' : '';
}

/* ── LOAD FROM SUPABASE ── */
async function loadNotifications() {
  try {
    const d = await sb('notificaciones?usuario_id=eq.default&order=fecha.desc&limit=80');
    // Los avisos de racha/deuda no se muestran (rediseño: sin culpa)
    notifCache = (d || []).filter(n => n.tipo !== 'racha' && n.tipo !== 'repaso');
    renderNotifList();
    updateBadge();
    updateNotifStats();
  } catch (e) {
    console.error('Notif load:', e);
    // Fallback: show empty state gracefully
    notifCache = [];
    renderNotifList();
  }
}

/* ── RENDER LIST WITH FILTERS AND DATE GROUPS ── */
function renderNotifList() {
  const list = document.getElementById('notif-list');
  const filtered = currentFilter === 'all'
    ? notifCache
    : notifCache.filter(n => n.tipo === currentFilter);

  // Update filter counts
  updateFilterCounts();

  if (!filtered.length) {
    const filterLabel = currentFilter === 'all' ? '' : ' de este tipo';
    list.innerHTML = '<div class="notif-empty">' +
      '<div class="notif-empty-icon">' + (currentFilter === 'all' ? '🔔' : getFilterIcon(currentFilter)) + '</div>' +
      '<div class="notif-empty-title">Sin notificaciones' + filterLabel + '</div>' +
      '<div class="notif-empty-sub">Completa lecciones, tests y repasos<br>para desbloquear logros.</div></div>';
    return;
  }

  // Group by date
  let html = '';
  let lastDateLabel = '';

  filtered.forEach(n => {
    const dateLabel = getDateLabel(n.fecha);
    if (dateLabel !== lastDateLabel) {
      html += '<div class="notif-date-sep">' + dateLabel + '</div>';
      lastDateLabel = dateLabel;
    }

    const cls = n.leida ? '' : ' unread';
    const tipoClass = 'tipo-' + (n.tipo || 'sistema');
    const ico = n.icono || '🔔';
    const tipoTag = n.tipo ? '<span class="notif-tipo-tag">' + (n.tipo || '') + '</span>' : '';

    html += '<div class="notif-item' + cls + '" data-id="' + n.id + '" onclick="markNotifRead(\x27' + n.id + '\x27,this)">' +
      '<span class="notif-dot"></span>' +
      '<div class="notif-icon-wrap ' + tipoClass + '">' + escH(ico) + '</div>' +
      '<div class="notif-content">' +
        '<div class="notif-title">' + escH(n.titulo) + '</div>' +
        '<div class="notif-msg">' + escH(n.mensaje) + '</div>' +
        '<div class="notif-meta">' +
          '<span class="notif-time">' + timeAgo(n.fecha) + '</span>' +
          tipoTag +
        '</div>' +
      '</div>' +
      '<button class="notif-dismiss" onclick="event.stopPropagation();dismissNotif(\x27' + n.id + '\x27,this)" title="Eliminar">✕</button>' +
    '</div>';
  });

  list.innerHTML = html;
}

/* ── FILTER SYSTEM ── */
function filterNotifs(tipo, btn) {
  currentFilter = tipo;
  document.querySelectorAll('.notif-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderNotifList();
}

function updateFilterCounts() {
  const counts = { all: notifCache.length, logro: 0, racha: 0, repaso: 0, quiz: 0, sistema: 0 };
  notifCache.forEach(n => {
    const t = n.tipo || 'sistema';
    if (counts[t] !== undefined) counts[t]++;
  });
  document.querySelectorAll('.notif-filter-btn').forEach(btn => {
    const f = btn.dataset.filter;
    const existing = btn.querySelector('.notif-filter-count');
    if (existing) existing.remove();
    if (counts[f] > 0) {
      const span = document.createElement('span');
      span.className = 'notif-filter-count';
      span.textContent = counts[f];
      btn.appendChild(span);
    }
  });
}

function getFilterIcon(tipo) {
  const icons = { logro: '🏆', racha: '🔥', repaso: '📋', quiz: '🧠', sistema: '⚙' };
  return icons[tipo] || '🔔';
}

/* ── DATE LABELS ── */
function getDateLabel(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((today - itemDate) / 86400000);

  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7) return 'Esta semana';
  if (diff < 30) return 'Este mes';
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

/* ── BADGE & STATS ── */
function updateBadge() {
  const unread = notifCache.filter(n => !n.leida && n.tipo !== 'racha' && n.tipo !== 'repaso').length;
  ['notif-badge', 'notif-badge-mobile'].forEach(id => {
    const b = document.getElementById(id);
    if (b) {
      b.style.display = unread > 0 ? 'flex' : 'none';
      b.textContent = unread > 99 ? '99+' : unread;
    }
  });
  // Ring the bell on new notifications
  if (unread > 0) {
    const bell = document.getElementById('notif-bell');
    if (bell && !bell.classList.contains('ring')) {
      bell.classList.add('ring');
      setTimeout(() => bell.classList.remove('ring'), 700);
    }
  }
}

function updateNotifStats() {
  const total = notifCache.length;
  const unread = notifCache.filter(n => !n.leida).length;
  const logros = notifCache.filter(n => n.tipo === 'logro').length;
  const el = id => document.getElementById(id);
  if (el('notif-stat-total')) el('notif-stat-total').textContent = total;
  if (el('notif-stat-unread')) el('notif-stat-unread').textContent = unread;
  if (el('notif-stat-logros')) el('notif-stat-logros').textContent = logros;
}

/* ── UTILS ── */
function escH(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function timeAgo(ds) {
  const d = new Date(ds), now = new Date(), s = Math.floor((now - d) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return Math.floor(s / 60) + ' min';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 172800) return 'ayer';
  if (s < 604800) return Math.floor(s / 86400) + 'd';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/* ── MARK READ ── */
async function markNotifRead(id, el) {
  if (el) {
    el.classList.remove('unread');
    // Smooth dot fade
    const dot = el.querySelector('.notif-dot');
    if (dot) dot.style.opacity = '0';
  }
  const n = notifCache.find(x => x.id === id);
  if (n) n.leida = true;
  updateBadge();
  updateNotifStats();
  try {
    await fetch(SB_URL + '/rest/v1/notificaciones?id=eq.' + id, {
      method: 'PATCH',
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ leida: true })
    });
  } catch (e) { /* silent */ }
}

async function markAllRead() {
  notifCache.forEach(n => { n.leida = true; });
  renderNotifList();
  updateBadge();
  updateNotifStats();
  try {
    await fetch(SB_URL + '/rest/v1/notificaciones?usuario_id=eq.default&leida=eq.false', {
      method: 'PATCH',
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ leida: true })
    });
  } catch (e) { /* silent */ }
}

/* ── DISMISS (DELETE) NOTIFICATION ── */
async function dismissNotif(id, btn) {
  const item = btn.closest('.notif-item');
  if (item) {
    item.style.transition = 'all 0.3s ease';
    item.style.transform = 'translateX(100%)';
    item.style.opacity = '0';
    setTimeout(() => item.remove(), 300);
  }
  notifCache = notifCache.filter(n => n.id !== id);
  updateBadge();
  updateNotifStats();
  updateFilterCounts();
  try {
    await fetch(SB_URL + '/rest/v1/notificaciones?id=eq.' + id, {
      method: 'DELETE',
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Prefer': 'return=minimal' }
    });
  } catch (e) { /* silent */ }
}

/* ── ACHIEVEMENT TOAST WITH QUEUE ── */
function showAchievement(icon, title, msg) {
  notifAchievementQueue.push({ icon, title, msg });
  if (!isShowingAchievement) processAchievementQueue();
}

function processAchievementQueue() {
  if (!notifAchievementQueue.length) {
    isShowingAchievement = false;
    return;
  }
  isShowingAchievement = true;
  const { icon, title, msg } = notifAchievementQueue.shift();

  const t = document.getElementById('achievement-toast');
  const progBar = document.getElementById('ach-progress-bar');
  document.getElementById('ach-icon').textContent = icon;
  document.getElementById('ach-title').textContent = title;
  document.getElementById('ach-msg').textContent = msg;

  // Reset and animate progress bar
  progBar.style.transition = 'none';
  progBar.style.width = '100%';

  t.classList.add('show');

  requestAnimationFrame(() => {
    progBar.style.transition = 'width 5s linear';
    progBar.style.width = '0%';
  });

  // Send browser push notification too
  sendPushNotif(title, msg, icon);

  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(processAchievementQueue, 400);
  }, 5200);
}

function spawnAchievementParticles() {
  const container = document.getElementById('ach-particles');
  if (!container) return;
  container.innerHTML = '';
  const chars = ['✦', '★', '◆', '●'];
  for (let i = 0; i < 6; i++) {
    const p = document.createElement('span');
    p.textContent = chars[Math.floor(Math.random() * chars.length)];
    p.style.cssText = 'position:absolute;font-size:' + (8 + Math.random() * 6) + 'px;color:var(--accent);opacity:0;' +
      'left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;' +
      'animation:particleFade ' + (0.8 + Math.random() * 0.6) + 's ease ' + (Math.random() * 0.3) + 's forwards;';
    container.appendChild(p);
  }
}

// Particle animation (injected once)
if (!document.getElementById('notif-particle-style')) {
  const ps = document.createElement('style');
  ps.id = 'notif-particle-style';
  ps.textContent = '@keyframes particleFade{0%{opacity:0;transform:scale(0) translateY(0)}40%{opacity:0.7;transform:scale(1.2) translateY(-10px)}100%{opacity:0;transform:scale(0.5) translateY(-25px)}}';
  document.head.appendChild(ps);
}

/* ── POLLING: CHECK FOR NEW NOTIFICATIONS ── */
async function checkForNewNotifications() {
  const now = Date.now();
  if (now - lastNotifCheck < 15000) return; // min 15s between checks
  lastNotifCheck = now;
  try {
    const d = await sb('notificaciones?usuario_id=eq.default&leida=eq.false&order=fecha.desc&limit=10');
    if (d && d.length) {
      const newOnes = d.filter(n => !notifCache.find(c => c.id === n.id));
      newOnes.filter(n => n.tipo !== 'racha' && n.tipo !== 'repaso').forEach(n => {
        showAchievement(n.icono || '🔔', n.titulo, n.mensaje);
        notifCache.unshift(n);
      });
      if (newOnes.length) {
        updateBadge();
        updateNotifStats();
      }
    }
  } catch (e) { /* silent */ }
}

/* ── STREAK & REPASO CHECK ── */
async function checkStreakAndRepasos() {
  // Ya no se consulta check_racha / check_repaso_pendiente: generaban avisos de culpa
  // («Racha perdida», «N repasos pendientes»). La constancia se ve en el atril.
  try { await loadNotifications(); }
  catch (e) { console.error('Notificaciones:', e); }
}

/* ── PUSH NOTIFICATIONS (Browser Notification API) ── */
function checkPushPermission() {
  const area = document.getElementById('push-banner-area');
  if (!area) return;

  if (!('Notification' in window)) {
    area.innerHTML = '';
    return;
  }

  if (Notification.permission === 'granted') {
    const ok = !!localStorage.getItem(PUSH_FLAG);
    area.innerHTML = ok
      ? '<div style="padding:0.6rem 1.1rem;font-size:0.68rem;color:var(--success);font-family:var(--font-mono);display:flex;align-items:center;gap:0.4rem;">✓ Recordatorio activo en este móvil</div>'
      : '<div class="push-banner"><div class="push-banner-icon">🔔</div><div class="push-banner-text"><strong>Falta un paso</strong><br>El permiso está concedido, pero este móvil aún no está registrado para recibir el recordatorio.</div><button class="push-banner-btn" onclick="pushActivarManual()">Registrar</button></div>';
    return;
  }

  if (Notification.permission === 'denied') {
    area.innerHTML = '<div style="padding:0.6rem 1.1rem;font-size:0.68rem;color:var(--text3);font-family:var(--font-mono);">Push bloqueadas — actívalas desde la config del navegador</div>';
    return;
  }

  // permission === 'default' — show banner
  area.innerHTML = '<div class="push-banner">' +
    '<div class="push-banner-icon">🔔</div>' +
    '<div class="push-banner-text"><strong>Notificaciones push</strong><br>Un aviso al día con la idea de hoy, solo si aún no has hecho la sesión. Nada de rachas ni urgencia.</div>' +
    '<button class="push-banner-btn" onclick="reqPushPerm()">Activar</button>' +
    '<button class="push-banner-dismiss" onclick="this.parentElement.remove()">✕</button>' +
  '</div>';
}

async function reqPushPerm() { return pushActivarManual(); }

function sendPushNotif(title, body) {
  // ANTI-SPAM PROTECCIÓN: ¡Nunca lanzar un cartel al SO Android si el usuario ya está viendo la app!
  if (!document.hidden) return;

  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    // Use Service Worker for persistent notifications (works even in background on Android)
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title: title,
        body: body,
        tag: 'scs-' + Date.now()
      });
    } else {
      // Fallback to basic Notification API
      new Notification(title, {
        body: body,
        icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="%23080808"/><text x="32" y="42" text-anchor="middle" font-size="28" fill="%23c9a84c">§</text></svg>'),
        tag: 'scs-' + Date.now()
      });
    }
  } catch (e) { /* silent */ }
}

/* ── SERVICE WORKER REGISTRATION ── */
if ('serviceWorker' in navigator) {
  // Force nuke all old caches on load
  caches.keys().then(names => names.forEach(n => caches.delete(n)));
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    console.log('SCS Service Worker registered:', reg.scope);
    reg.update(); // Force immediate check for new SW
  }).catch(err => {
    console.warn('SW registration failed:', err);
  });
}

/* ── NOTIFICATION SETTINGS ── */
const NOTIF_CONFIG_KEY = 'scs_notif_config';
let notifConfig = {
  racha: true,
  repaso: true,
  logro: true,
  quiz: true,
  sistema: true,
  reminderOn: false,
  reminderTime: '21:30',
  sound: false
};

function loadNotifConfig() {
  try {
    const saved = localStorage.getItem(NOTIF_CONFIG_KEY);
    if (saved) notifConfig = { ...notifConfig, ...JSON.parse(saved) };
  } catch (e) {}
  // Apply to UI
  const el = id => document.getElementById(id);
  if (el('ncfg-racha')) el('ncfg-racha').checked = notifConfig.racha;
  if (el('ncfg-repaso')) el('ncfg-repaso').checked = notifConfig.repaso;
  if (el('ncfg-logro')) el('ncfg-logro').checked = notifConfig.logro;
  if (el('ncfg-quiz')) el('ncfg-quiz').checked = notifConfig.quiz;
  if (el('ncfg-sistema')) el('ncfg-sistema').checked = notifConfig.sistema;
  if (el('ncfg-reminder-on')) el('ncfg-reminder-on').checked = notifConfig.reminderOn;
  if (el('ncfg-reminder-time')) el('ncfg-reminder-time').value = notifConfig.reminderTime;
  if (el('ncfg-sound')) el('ncfg-sound').checked = notifConfig.sound;
  updateReminderTimeVisibility();
  pushPintarEstado();
}

function saveNotifConfig() {
  const el = id => document.getElementById(id);
  notifConfig.racha = el('ncfg-racha')?.checked ?? true;
  notifConfig.repaso = el('ncfg-repaso')?.checked ?? true;
  notifConfig.logro = el('ncfg-logro')?.checked ?? true;
  notifConfig.quiz = el('ncfg-quiz')?.checked ?? true;
  notifConfig.sistema = el('ncfg-sistema')?.checked ?? true;
  const estabaOn = notifConfig.reminderOn, horaAntes = notifConfig.reminderTime;
  notifConfig.reminderOn = el('ncfg-reminder-on')?.checked ?? false;
  notifConfig.reminderTime = el('ncfg-reminder-time')?.value || '21:30';
  notifConfig.sound = el('ncfg-sound')?.checked ?? false;
  localStorage.setItem(NOTIF_CONFIG_KEY, JSON.stringify(notifConfig));
  updateReminderTimeVisibility();
  if (notifConfig.reminderOn && !estabaOn) {
    // Push real desde el servidor: el permiso se pide aquí, al activar el recordatorio.
    pushActivar().then(ok => {
      if (!ok) { notifConfig.reminderOn = false; localStorage.setItem(NOTIF_CONFIG_KEY, JSON.stringify(notifConfig)); loadNotifConfig(); }
      scheduleReminder(); pushPintarEstado(); checkPushPermission();
    });
    return;
  }
  if (!notifConfig.reminderOn && estabaOn) pushDesactivar().then(() => { pushPintarEstado(); checkPushPermission(); });
  else if (notifConfig.reminderOn && notifConfig.reminderTime !== horaAntes) pushSincronizar();
  scheduleReminder();
}

function updateReminderTimeVisibility() {
  const row = document.getElementById('notif-reminder-time-row');
  if (row) row.classList.toggle('visible', notifConfig.reminderOn);
}

function toggleNotifSettings() {
  const panel = document.getElementById('notif-settings');
  const btn = document.getElementById('notif-settings-btn');
  const isOpen = panel.classList.toggle('open');
  btn.textContent = isOpen ? '⚙ Cerrar' : '⚙ Config';
  if (isOpen) loadNotifConfig();
}

/* ── FILTER showAchievement BY CONFIG ── */
const _originalShowAchievement = showAchievement;
showAchievement = function(icon, title, msg, tipo) {
  // Determine tipo from icon/title if not passed
  if (!tipo) {
    if (title.includes('racha') || title.includes('Racha')) tipo = 'racha';
    else if (title.includes('repaso') || title.includes('Repaso')) tipo = 'repaso';
    else if (title.includes('quiz') || title.includes('Quiz') || title.includes('test')) tipo = 'quiz';
    else if (icon === '🏆' || title.includes('logro') || title.includes('Logro')) tipo = 'logro';
    else tipo = 'sistema';
  }
  // Check if this type is enabled
  if (notifConfig[tipo] === false) return;
  // Play sound if enabled
  if (notifConfig.sound) playNotifSound();
  _originalShowAchievement(icon, title, msg);
};

/* ── NOTIFICATION SOUND ── */
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

/* ── DAILY REMINDER SCHEDULER ── */
let reminderTimer = null;

function scheduleReminder() {
  if (reminderTimer) clearTimeout(reminderTimer);
  if (!notifConfig.reminderOn) return;
  if (localStorage.getItem(PUSH_FLAG)) return;   // el servidor ya avisa; evita duplicados

  const [h, m] = notifConfig.reminderTime.split(':').map(Number);
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);

  // If time already passed today, schedule for tomorrow
  if (target <= now) target.setDate(target.getDate() + 1);

  const ms = target - now;
  console.log('SCS reminder scheduled in', Math.round(ms / 60000), 'min');

  reminderTimer = setTimeout(() => {
    // Solo si la sesión de hoy no está hecha
    const hecha = (typeof isNocheCerrada === 'function') && isNocheCerrada();
    if (!hecha) {
      showAchievement('§', 'El atril está puesto', 'Una lección de pocos minutos, cuando quieras.', 'sistema');
    }
    // Reschedule for next day
    scheduleReminder();
  }, ms);
}

/* ── CLEAR ALL NOTIFICATIONS ── */
async function clearAllNotifications() {
  if (!confirm('¿Borrar TODAS las notificaciones? Esta acción no se puede deshacer.')) return;
  notifCache = [];
  renderNotifList();
  updateBadge();
  updateNotifStats();
  try {
    await fetch(SB_URL + '/rest/v1/notificaciones?usuario_id=eq.default', {
      method: 'DELETE',
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Prefer': 'return=minimal' }
    });
    toast('Notificaciones eliminadas');
  } catch (e) { toast('Error al eliminar'); }
}

/* ── INSIGNIA EN EL ICONO (PWA instalada, Android/Chrome) ──
   Un punto mientras la sesión de hoy está pendiente; se quita al cerrarla. */
function actualizarInsigniaApp() {
  try {
    if (!('setAppBadge' in navigator)) return;
    const hecha = (typeof isNocheCerrada === 'function') && isNocheCerrada();
    if (hecha) { if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {}); }
    else navigator.setAppBadge(1).catch(() => {});
  } catch (e) { /* silent */ }
}

/* ── WEB PUSH REAL: el recordatorio diario lo envía el servidor (supabase/functions/enviar-recordatorios) ──
   Funciona con la app cerrada. El servidor decide si toca (hora, sesión ya hecha, frecuencia). */
const VAPID_PUBLIC = 'BAfu2l74SEKwQaKdOlXAMQYvaW0yBJ6Kgr3ga4eyJ7cwnMIP0EtSzN_GcWLXaetbf6YXykLUi6_rL5v9zg7no5M';
const PUSH_FLAG = 'scs_push_activo';
const PUSH_ERR = 'scs_push_error';

function vapidBytes(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
const pushHeaders = extra => Object.assign({ 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }, extra || {});

/** Lección que toca hoy (la calcula la app); el aviso lleva su idea y título. */
function proximaLeccionPush() {
  try {
    const l = (typeof pickNocheLeccion === 'function') ? pickNocheLeccion() : null;
    return l ? { proxima_leccion_id: l.id, proxima_titulo: l.titulo || null, proxima_idea: l.idea_clave || null } : {};
  } catch (e) { return {}; }
}

async function pushActivar() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) { pushError('Este navegador no admite notificaciones push'); return false; }
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') { pushError('Sin permiso de notificaciones'); return false; }
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('el service worker no está listo (cierra y abre la app)')), 8000))]);
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidBytes(VAPID_PUBLIC) });
    const j = sub.toJSON();
    const fila = Object.assign({
      endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
      hora: notifConfig.reminderTime, activo: true,
      user_agent: (navigator.userAgent || '').slice(0, 200), actualizada: new Date().toISOString()
    }, proximaLeccionPush());
    const r = await fetch(SB_URL + '/rest/v1/push_suscripciones?on_conflict=endpoint', {
      method: 'POST', headers: pushHeaders({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(fila)
    });
    if (!r.ok) throw new Error('registro en el servidor: ' + r.status);
    localStorage.setItem(PUSH_FLAG, '1'); localStorage.removeItem(PUSH_ERR);
    toast('Recordatorio activado: un aviso al día, a las ' + notifConfig.reminderTime);
    return true;
  } catch (e) {
    console.error('Push:', e); pushError((e && e.name ? e.name + ': ' : '') + ((e && e.message) || 'error desconocido')); return false;
  }
}

/** Guarda y muestra el motivo si no se pudo activar, para no tener que adivinar. */
function pushError(msg) {
  try { localStorage.setItem(PUSH_ERR, msg); } catch (e) { /* silent */ }
  toast('No se pudo activar el recordatorio: ' + msg);
}

/** Línea de estado bajo el recordatorio: activo / sin activar / bloqueado, con botón si falta el registro. */
function pushPintarEstado() {
  const el = document.getElementById('push-estado');
  if (!el) return;
  if (!('Notification' in window) || !('PushManager' in window)) { el.textContent = 'Este navegador no admite notificaciones push.'; return; }
  const err = localStorage.getItem(PUSH_ERR);
  if (Notification.permission === 'denied') { el.textContent = 'Estado: permiso bloqueado. Actívalo en los ajustes del navegador para este sitio.'; return; }
  if (localStorage.getItem(PUSH_FLAG)) { el.innerHTML = 'Estado: <strong style="color:var(--success)">activo en este móvil</strong> (' + escH(notifConfig.reminderTime) + ').'; return; }
  el.innerHTML = 'Estado: <strong>sin activar en este móvil</strong>.' + (err ? ' Último error: ' + escH(err) + '.' : '') +
    ' <button class="push-banner-btn" style="margin-left:0.4rem" onclick="pushActivarManual()">Activar ahora</button>';
}

/** Activa el recordatorio con un gesto del usuario (botones «Activar ahora» / «Registrar» / banner). */
async function pushActivarManual() {
  const ok = await pushActivar();
  if (ok) {
    notifConfig.reminderOn = true;
    try { localStorage.setItem(NOTIF_CONFIG_KEY, JSON.stringify(notifConfig)); } catch (e) { /* silent */ }
    loadNotifConfig();
  }
  pushPintarEstado(); checkPushPermission();
  return ok;
}

async function pushDesactivar() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch(SB_URL + '/rest/v1/push_suscripciones?endpoint=eq.' + encodeURIComponent(sub.endpoint), {
        method: 'PATCH', headers: pushHeaders({ 'Prefer': 'return=minimal' }), body: JSON.stringify({ activo: false, actualizada: new Date().toISOString() })
      });
      await sub.unsubscribe();
    }
  } catch (e) { /* silent */ }
  localStorage.removeItem(PUSH_FLAG);
}

/** Mantiene en el servidor la hora y la lección de hoy. Barato: un PATCH al abrir y al cerrar la sesión. */
async function pushSincronizar() {
  try {
    if (!localStorage.getItem(PUSH_FLAG) || !('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) { localStorage.removeItem(PUSH_FLAG); return; }
    await fetch(SB_URL + '/rest/v1/push_suscripciones?endpoint=eq.' + encodeURIComponent(sub.endpoint), {
      method: 'PATCH', headers: pushHeaders({ 'Prefer': 'return=minimal' }),
      body: JSON.stringify(Object.assign({ hora: notifConfig.reminderTime, actualizada: new Date().toISOString() }, proximaLeccionPush()))
    });
  } catch (e) { /* silent */ }
}

/** Si la app se abre desde un aviso (?aviso=<id>), lo deja anotado para medir cuántos avisos sirven. */
function pushMarcarAbierto() {
  try {
    const u = new URL(location.href), id = u.searchParams.get('aviso');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    fetch(SB_URL + '/rest/v1/push_avisos?id=eq.' + id + '&abierto=is.null', {
      method: 'PATCH', headers: pushHeaders({ 'Prefer': 'return=minimal' }), body: JSON.stringify({ abierto: new Date().toISOString() })
    }).catch(() => {});
    u.searchParams.delete('aviso'); history.replaceState(null, '', u.pathname + u.search + u.hash);
  } catch (e) { /* silent */ }
}

// Load config on startup
loadNotifConfig();
scheduleReminder();
setTimeout(actualizarInsigniaApp, 3000);
setTimeout(() => {
  if (notifConfig.reminderOn && !localStorage.getItem(PUSH_FLAG) && 'Notification' in window && Notification.permission === 'granted') pushActivar().then(pushPintarEstado);
  else pushSincronizar();
}, 3500);
pushMarcarAbierto();

/* ── SMART POLLING ── */
// Initial check after page load
setTimeout(checkStreakAndRepasos, 2500);

// Poll every 45s when visible, pause when hidden
if (window._notifPollInterval) clearInterval(window._notifPollInterval);
window._notifPollInterval = setInterval(() => {
  if (!document.hidden) checkForNewNotifications();
}, 45000);

// Restart polling when tab becomes visible
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    actualizarInsigniaApp();
    checkForNewNotifications();
  }
});

// Keyboard shortcut: Escape to close panel
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && notifPanelOpen) toggleNotifPanel();
});
