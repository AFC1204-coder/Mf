/* ═══════════════════════════════════════════
   CUENTA — inicio de sesión con correo y contraseña (Supabase Auth por REST)
   La sesión se guarda en el dispositivo y se renueva sola (refresh token), así que se entra una vez por
   dispositivo. El formulario es un <form> normal con autocomplete: el navegador ofrece guardar la
   contraseña. Con la sesión, las peticiones llevan el token del usuario en vez de la clave pública.
   La parte pura está en lib/cuenta.js.
═══════════════════════════════════════════ */
const Cuenta = (() => {
  const K = 'scs2_cuenta', K_EMAIL = 'scs2_cuenta_email', K_SALTAR = 'scs2_cuenta_saltar';
  /** Mientras sea false se puede «Seguir sin cuenta». Se pondrá a true cuando la base de datos exija la sesión. */
  const OBLIGATORIA = false;

  let sesion = null, cargada = false, renovando = null, timer = null;
  const ahora = () => Date.now();

  function cargar() {
    if (cargada) return;
    cargada = true;
    try { sesion = JSON.parse(localStorage.getItem(K)) || null; } catch (e) { sesion = null; }
    programar();
  }
  function guardar(s) {
    sesion = s;
    try { if (s) localStorage.setItem(K, JSON.stringify(s)); else localStorage.removeItem(K); } catch (e) {}
    programar();
  }
  /** Renueva el token un poco antes de que caduque mientras la app está abierta. */
  function programar() {
    clearTimeout(timer);
    if (!sesion || !sesion.refresh) return;
    timer = setTimeout(() => { token(true).catch(() => {}); }, CuentaLib.renovarEn(sesion, ahora()));
  }

  async function llamar(ruta, cuerpo, conToken) {
    const h = { apikey: SB_KEY, 'Content-Type': 'application/json' };
    if (conToken && sesion) h.Authorization = 'Bearer ' + sesion.access;
    let r;
    try { r = await fetch(`${SB_URL}/auth/v1/${ruta}`, { method: 'POST', headers: h, body: JSON.stringify(cuerpo || {}) }); }
    catch (e) { return { status: 0, cuerpo: null }; }
    let cuerpoR = null;
    try { cuerpoR = await r.json(); } catch (e) {}
    return { status: r.status, ok: r.ok, cuerpo: cuerpoR };
  }

  /** Token de acceso válido (renovándolo si hace falta) o null si no hay sesión. Una sola renovación a la vez. */
  async function token(forzar) {
    cargar();
    if (!sesion) return null;
    if (!forzar && CuentaLib.vigente(sesion, ahora())) return sesion.access;
    if (!sesion.refresh) return CuentaLib.vigente(sesion, ahora(), 0) ? sesion.access : null;
    if (!renovando) {
      renovando = (async () => {
        const r = await llamar('token?grant_type=refresh_token', { refresh_token: sesion.refresh });
        if (r.ok) { const s = CuentaLib.sesionDe(r.cuerpo, ahora()); if (s) guardar(s); }
        else if (CuentaLib.sesionPerdida(r.status)) { guardar(null); refrescarVista(); }
        // sin red: se conserva la sesión y se vuelve a intentar luego
      })().finally(() => { renovando = null; });
    }
    await renovando;
    return sesion && CuentaLib.vigente(sesion, ahora(), 0) ? sesion.access : null;
  }
  /** Versión sin espera para código que no puede ser asíncrono (cabeceras de avisos). */
  function tokenSync() { cargar(); return sesion && CuentaLib.vigente(sesion, ahora(), 0) ? sesion.access : null; }
  const email = () => { cargar(); return sesion ? sesion.email : ''; };
  const activa = () => { cargar(); return !!sesion; };

  async function iniciar(correo, clave) {
    const error = CuentaLib.validarEntrada(correo, clave);
    if (error) return { ok: false, msg: error };
    const r = await llamar('token?grant_type=password', { email: String(correo).trim(), password: clave });
    if (!r.ok) return { ok: false, msg: CuentaLib.mensajeError(r.status, r.cuerpo) };
    const s = CuentaLib.sesionDe(r.cuerpo, ahora());
    if (!s) return { ok: false, msg: CuentaLib.mensajeError(500, null) };
    guardar(s);
    try { localStorage.setItem(K_EMAIL, String(correo).trim()); sessionStorage.removeItem(K_SALTAR); } catch (e) {}
    // Ofrece al navegador guardar la contraseña (Chrome/Edge/Android); en el resto lo hace el propio formulario.
    try { if (window.PasswordCredential && navigator.credentials) Promise.resolve(navigator.credentials.store(new PasswordCredential({ id: String(correo).trim(), password: clave, name: s.email }))).catch(() => {}); } catch (e) {}
    return { ok: true };
  }
  async function cerrar() {
    cargar();
    if (sesion) llamar('logout', {}, true).catch(() => {});
    guardar(null);
    try { sessionStorage.removeItem(K_SALTAR); } catch (e) {}
    refrescarVista();
    mostrar();
  }

  /* ── Pantalla de entrada ── */
  function overlay() {
    let o = document.getElementById('cuenta-overlay');
    if (o) return o;
    o = document.createElement('div');
    o.id = 'cuenta-overlay';
    o.className = 'cuenta-overlay';
    o.hidden = true;
    o.innerHTML = `
      <form class="cuenta-card" id="cuenta-form" method="post" action="#" autocomplete="on" role="dialog" aria-modal="true" aria-labelledby="cuenta-t">
        <h2 id="cuenta-t">Entrar en Mente fría</h2>
        <p class="cuenta-sub">Tus lecturas, notas y avances, iguales en el portátil y en el móvil.</p>
        <label class="cuenta-lab" for="cuenta-email">Correo</label>
        <input class="cuenta-in" type="email" id="cuenta-email" name="username" autocomplete="username" inputmode="email" autocapitalize="off" spellcheck="false" required>
        <label class="cuenta-lab" for="cuenta-pass">Contraseña</label>
        <input class="cuenta-in" type="password" id="cuenta-pass" name="password" autocomplete="current-password" required>
        <label class="cuenta-ver"><input type="checkbox" id="cuenta-ver"> Mostrar contraseña</label>
        <p class="cuenta-err" id="cuenta-err" role="alert"></p>
        <button type="submit" class="cuenta-btn" id="cuenta-ok">Entrar</button>
        <button type="button" class="cuenta-saltar" id="cuenta-saltar">Seguir sin cuenta</button>
      </form>`;
    document.body.appendChild(o);
    const f = o.querySelector('#cuenta-form'), err = o.querySelector('#cuenta-err'), btn = o.querySelector('#cuenta-ok');
    o.querySelector('#cuenta-ver').addEventListener('change', e => { o.querySelector('#cuenta-pass').type = e.target.checked ? 'text' : 'password'; });
    o.querySelector('#cuenta-saltar').addEventListener('click', () => { try { sessionStorage.setItem(K_SALTAR, '1'); } catch (e) {} ocultar(); });
    f.addEventListener('submit', async ev => {
      ev.preventDefault();
      err.textContent = ''; btn.disabled = true; btn.textContent = 'Entrando…';
      const r = await iniciar(o.querySelector('#cuenta-email').value, o.querySelector('#cuenta-pass').value);
      btn.disabled = false; btn.textContent = 'Entrar';
      if (!r.ok) { err.textContent = r.msg; return; }
      o.querySelector('#cuenta-pass').value = '';
      ocultar();
      alEntrar();
    });
    return o;
  }
  function mostrar() {
    if (typeof modoCarta === 'function' && modoCarta()) return;      // el invitado de un enlace compartido no inicia sesión
    const o = overlay();
    o.querySelector('#cuenta-saltar').hidden = OBLIGATORIA;
    const campo = o.querySelector('#cuenta-email');
    if (!campo.value) { try { campo.value = localStorage.getItem(K_EMAIL) || ''; } catch (e) {} }
    o.hidden = false;
    setTimeout(() => (campo.value ? o.querySelector('#cuenta-pass') : campo).focus(), 50);
  }
  function ocultar() { const o = document.getElementById('cuenta-overlay'); if (o) o.hidden = true; }

  /** Tras entrar: trae los datos del usuario y repinta. */
  function alEntrar() {
    refrescarVista();
    try { if (typeof forzarSincronizacion === 'function') forzarSincronizacion(); } catch (e) {}
    if (typeof toast === 'function') toast('Sesión iniciada');
  }
  function refrescarVista() { try { if (typeof renderTu === 'function') renderTu(); } catch (e) {} }

  /** Al abrir la app: si no hay sesión (ni se ha saltado en esta visita), enseña la pantalla de entrada. */
  async function alArrancar() {
    if (typeof modoCarta === 'function' && modoCarta()) return;
    cargar();
    if (sesion) { await token(); }              // renueva ya si hacía falta; si la sesión ya no vale, se borra
    if (activa()) return;
    let saltada = false;
    try { saltada = sessionStorage.getItem(K_SALTAR) === '1'; } catch (e) {}
    if (OBLIGATORIA || !saltada) mostrar();
  }

  /** Desde «Tú»: iniciar sesión o cerrarla. */
  function abrir() {
    cargar();
    if (!sesion) { mostrar(); return; }
    if (confirm('¿Cerrar la sesión en este dispositivo? Tus datos siguen guardados en tu cuenta.')) cerrar();
  }

  return { token, tokenSync, email, activa, iniciar, cerrar, abrir, mostrar, alArrancar, OBLIGATORIA };
})();
