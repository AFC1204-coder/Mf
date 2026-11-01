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
