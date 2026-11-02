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
1. **Hecho:** inicio de sesión opcional («Seguir sin cuenta»), sesión guardada y token usado en las peticiones. Los datos siguen siendo del usuario `default` y las políticas de seguridad (RLS) siguen aceptando la clave pública, así que nada se rompe mientras tanto.
2. **Pendiente (se hace tras comprobar que se entra bien en el portátil y en el móvil):** cerrar el acceso a los datos personales en la base de datos para que solo los lea y escriba la cuenta del dueño (políticas con `is_admin()`), y poner `OBLIGATORIA = true` en `cuenta-ui.js` para quitar «Seguir sin cuenta». Hasta entonces cualquiera con la clave pública de la app podría leer o escribir esos datos.

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
