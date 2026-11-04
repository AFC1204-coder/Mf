# Cuenta e inicio de sesión

La app entra con **correo y contraseña** (Supabase Auth, por REST; no hay librería extra).

## Cómo funciona
- `lib/cuenta.js` (puro, con pruebas): qué se guarda de la sesión, cuándo renovarla, cabeceras, mensajes de error.
- `cuenta-ui.js`: pantalla de entrada, sesión guardada en el dispositivo (`scs2_cuenta`) y renovación automática con el *refresh token*; se entra una vez por dispositivo.
- El formulario es un `<form>` normal con `autocomplete="username"` / `current-password`, así el navegador ofrece guardar la contraseña (y se llama a `navigator.credentials.store` donde existe).
- `sb()`, `sbAll()` y el resto de peticiones llevan el **token del usuario** si hay sesión, y la clave pública si no (`authBearer()` / `authHdr()` en `app.js`; `Cuenta.tokenSync()` en `notifications.js`).
- Los enlaces compartidos (`?carta=1`) no piden iniciar sesión.
- La cuenta es la que ya existía para `admin.html`. No hay registro desde la app.
- Contraseña olvidada: restablecerla desde Supabase → Authentication → Users.

## Estado
1. **Hecho (3 nov):** inicio de sesión con correo y contraseña, o con enlace/código por correo; sesión guardada y renovada sola; token en todas las peticiones.
2. **Hecho (4 nov 2026): cuenta obligatoria.** Se comprobó que se entra bien en el portátil y en el móvil y se cerró el acceso en la base de datos (`supabase/migrations/20261104_cuenta_obligatoria.sql`; reversión en `…_revertir.sql`):
   - Los **datos personales** (progreso, repaso, notas, favoritos, sesiones, subrayados, compromisos, estado de lectura, perfil, retos y respuestas, notificaciones y push) solo los lee y escribe la cuenta del dueño: política `to authenticated` con `is_admin()` (tabla `admins`, hoy solo alejandrofrutos1204@gmail.com) y `usuario_id = 'default'`. Con la clave pública sin sesión se ven 0 filas y no se puede escribir.
   - El **contenido** (libros, lecciones, preguntas, retos activos, escenarios) sigue de lectura pública: lo usan los enlaces compartidos.
   - «¿Algo no cuadra?» desde un enlace compartido sigue pudiendo enviarse (solo insertar); leerlos es solo del dueño.
   - La portada de un libro (`set_portada`) solo la fija una sesión iniciada.
   - Las funciones de servidor (cron de recordatorios) usan `service_role` y no pasan por estas políticas.
   - En la app, `OBLIGATORIA = true` en `cuenta-ui.js`: ya no existe «Seguir sin cuenta». Los enlaces `?carta=1` siguen sin pedir sesión.
   - Comprobación hecha con roles simulados: `anon` ve 0 filas en 10 tablas personales y su INSERT en `progreso` falla; el dueño ve todos sus datos.
3. **Si algo falla:** ejecutar `supabase/migrations/20261104_cuenta_obligatoria_revertir.sql` devuelve las políticas anteriores (y poner `OBLIGATORIA = false`).
4. **Nota:** si se pierde el acceso a la cuenta, la contraseña se restablece desde Supabase → Authentication → Users.

## Entrar sin contraseña: enlace o código por correo

Además de correo + contraseña, la pantalla de entrada tiene «Enviarme un enlace al correo». Supabase escribe al correo un enlace y, si la plantilla lo incluye, un código de 6 cifras.

- **Enlace:** al pulsarlo se vuelve a la app con la sesión en la dirección (`#access_token=…&refresh_token=…&type=magiclink`). `cuenta-ui.js` la lee al cargar (antes de que `app.js` interprete la dirección), la guarda, limpia la dirección y pregunta a `/auth/v1/user` de quién es para mostrar el correo en «Tú». Un enlace caducado (`#error=…&error_code=otp_expired`) enseña el mensaje en la pantalla de entrada. La lógica pura está en `lib/cuenta.js` (`sesionDeHash`, `limpiarCodigo`, `validarCorreo`).
- **Código:** se escribe dentro de la app (`POST /auth/v1/verify` con `type: 'email'`). Es el camino para la **app instalada en la pantalla de inicio del móvil**: el enlace del correo se abre en el navegador, que tiene su propio almacenamiento, y la sesión no llegaría a la app instalada.
- **Solo cuentas que ya existen:** la petición lleva `create_user: false`; no se puede crear una cuenta desde la app.

### Configuración necesaria en Supabase (hecha el 2026-11-02)
- *Authentication → URL Configuration*: **Site URL** `https://afc1204-coder.github.io/Mf/` y **Redirect URL** `https://afc1204-coder.github.io/Mf/**`. Estaba en `http://localhost:3000` y sin redirecciones.
- *Email* activado y *Confirm email* activado (la cuenta del dueño ya estaba confirmada).
- **Pendiente (solo para el código):** la plantilla «Magic Link» de *Authentication → Emails* debe incluir `{{ .Token }}` además del enlace; con la plantilla por defecto el correo trae solo el enlace.
- El servicio de correo integrado de Supabase tiene un límite de envíos muy bajo (pensado para pruebas): para una sola persona basta; si se abriera el registro a más gente habría que configurar un SMTP propio.
