# Recordatorio diario por Web Push

Un aviso al día, a la hora que elijas, **solo si la sesión de hoy no está hecha**, con la idea del día. Android + un solo usuario.

## Qué hace

| Pieza | Dónde | Estado |
|---|---|---|
| Insignia (punto) en el icono mientras la sesión de hoy está pendiente | `notifications.js` → `actualizarInsigniaApp` | En la app (paso 1) |
| Ajustes sin avisos de racha/repasos; hora por defecto 21:30 | `index.html`, `notifications.js` | En la app (paso 1) |
| Suscripción push, sincronización de hora y lección de hoy, marca de «abierto» | `notifications.js` (`pushActivar`, `pushSincronizar`, `pushMarcarAbierto`) | En la app, **inactiva hasta aplicar el servidor** |
| Mostrar el push y abrir la app | `sw.js` (`push`, `notificationclick`) | En la app |
| Tablas `push_suscripciones`, `push_avisos`, vista `v_avisos_eficacia` | `supabase/migrations/20261014_push_recordatorios.sql` | **Sin aplicar** |
| Decide a quién avisar, envía y deja constancia | `supabase/functions/enviar-recordatorios/` (`logica.js` con tests, `index.ts`) | **Sin desplegar** |
| Programación cada 15 min | `supabase/push_cron.sql` | **Sin ejecutar** |

## Reglas (fijadas por `logica.js` y probadas en `tests/avisos.test.js`)

- Un aviso al día como máximo; a la hora elegida (hasta 6 h tarde si falla el cron, después no).
- El día acaba a las 04:00 (como en toda la app): un aviso a la 01:00 pertenece al día anterior.
- No se envía si hay un `sesion_cerrada` hoy en `eventos`.
- Tras 3 avisos sin sesión ese día pasa a semanal y **lo dice una vez** en el propio aviso; vuelve a diario cuando haces una sesión.
- El texto es la idea de la lección que toca (la calcula la app) y su título. Sin racha, pérdidas ni urgencia.
- Si el móvil ya no acepta el push (404/410), la suscripción se desactiva sola.

## Medición

`v_avisos_eficacia`: por semana, avisos evaluados, con sesión ese día y con sesión en menos de 2 h. Si el porcentaje en 2 h es bajo durante semanas, el aviso no está ayudando.

## Aplicar el servidor (en este orden)

1. **Migración**: ejecutar `supabase/migrations/20261014_push_recordatorios.sql`.
2. **Secretos**: se guardan en el Vault de Supabase (`vapid_publica`, `vapid_privada`, `vapid_subject`, `cron_secret`, `proyecto_url`); la función los lee con `push_secreto()`, que solo puede ejecutar `service_role`. La clave pública es la misma que `VAPID_PUBLIC` en `notifications.js`. La privada **no está en el repositorio**.
3. **Desplegar** `enviar-recordatorios` con `verify_jwt: false` (la protege `x-cron-secret`, no un JWT, porque la llama `pg_cron`).
4. **Activar en el móvil**: ajustes de notificaciones → «Recordatorio diario» → aceptar el permiso. Comprobar que aparece la fila en `push_suscripciones`.
5. **Probar sin enviar**: llamar a la función con `?dry=1` y la cabecera `x-cron-secret`; devuelve qué haría (`tocaria`, `sesion_hecha`, `aun_no_es_la_hora`…).
6. **Programar**: ejecutar `supabase/push_cron.sql` (el cron lee `proyecto_url` y `cron_secret` del Vault).

Para quitarlo todo: `select cron.unschedule('enviar-recordatorios');` y desactivar el recordatorio en la app.

## Notas de seguridad

- Las tablas nuevas tienen RLS activada. La app usa la clave anónima, así que puede registrar su suscripción y marcar un aviso como abierto. Conocer un `endpoint` no permite enviar nada: hace falta la clave privada VAPID.
- `eventos`, `compromisos`, `perfil_usuario`, `repaso` y otras 20 tablas **ya existentes** tienen RLS desactivada (aviso de Supabase). No se tocan aquí.
