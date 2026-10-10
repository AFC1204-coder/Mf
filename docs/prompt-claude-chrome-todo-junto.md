# Prompt para Claude en Chrome — TODO de una sentada

Qué hace, en este orden: (1) migración de infografías en Supabase, (2) abrir el PR y fusionarlo en `main`,
(3) preparar los secretos de GitHub, (4) lanzar el workflow de infografías (primero simulación, luego 3 libros),
(5) opcional: cerrar el registro público de usuarios en Supabase Auth.

Antes de pegarlo:
- Inicia sesión en **Supabase**, **GitHub** y **OpenAI** (platform.openai.com) en ese mismo Chrome. No le des tus credenciales a Claude.
- Sustituye `[TU_EMAIL_ADMIN]` (aparece 2 veces, debajo de la línea) por el email del administrador de Supabase que creaste.
- Ten a mano un momento: te pedirá que **tú** escribas contraseñas y claves y que **confirmes** el único gasto (≈ 0,15 $).

Copia todo lo que hay debajo de la línea.

---

Necesito que hagas varias tareas seguidas en mis cuentas, en este orden y sin saltarte las pausas. Hazlo tú en el navegador, paso a paso, y al final cuéntame todo.

Datos:
- Supabase: proyecto "Mente fría", ref `aduizdiiacrvpoavjmab`.
- GitHub: repositorio `AFC1204-coder/Mf`. Rama a fusionar: `claude/mente-fria-daily-redesign-pt8obx` → `main`.
- Email del administrador de Supabase: `[TU_EMAIL_ADMIN]`

## Reglas generales (valen para todo)
- Trabaja solo en esos tres sitios (Supabase, GitHub, OpenAI) y solo en lo que se describe. No cambies nada más: ni otros ajustes, ni otras ramas, ni otros workflows, ni facturación, ni miembros.
- **Nunca veas, generes, copies, escribas ni leas en voz alta contraseñas, claves de API ni valores de secretos.** Cuando haga falta uno, para y pídeme que lo escriba o pegue yo en el navegador; espera a que te diga "hecho" y sigue. No me pidas que te lo dicte ni lo copies al chat.
- Si te pide iniciar sesión en cualquier sitio, para y avísame; yo me identifico.
- Si algo no coincide con lo descrito (proyecto o repositorio distinto, errores, avisos que no esperabas, conflictos), **para y cuéntamelo** antes de seguir. No improvises ni intentes saltarte bloqueos (revisiones obligatorias, protecciones, verificaciones de identidad o de organización).
- No borres ramas, no hagas force-push, no cierres ni fusiones otros PR.
- Al terminar cada fase, escribe una línea de estado ("FASE n: hecha / parada, motivo"). Si una fase se para, **no sigas con las que dependen de ella** y dime cuáles quedan sin hacer (la fase 5 es independiente de las demás).

## FASE 1 — Migración de infografías en Supabase
1. Abre https://supabase.com/dashboard/project/aduizdiiacrvpoavjmab/sql/new y comprueba que el proyecto es el de Mente fría.
2. Comprobación previa (debe dar `col_infografia = 0` y `bucket = 0`; si ya dan 1 o más, para y avísame):
   ```sql
   select (select count(*) from information_schema.columns where table_name='libros' and column_name like 'infografia_%') col_infografia,
          (select count(*) from storage.buckets where id='infografias') bucket;
   ```
3. Borra el contenido del editor y pega el SQL del bloque "MIGRACIÓN" del final de este mensaje, tal cual. Comprueba que se pegó entero (la última línea es `exception when duplicate_object then null; end $$;`). Si el editor lo corta, pégalo por partes siguiendo los comentarios y ejecútalas en orden.
4. Pulsa **Run**. Debe decir "Success" sin errores. Si Supabase muestra un aviso de operación destructiva o de seguridad, léelo: esta migración solo añade columnas a `libros`, crea el bucket público `infografias` y 3 políticas de escritura en `storage.objects` limitadas a administradores; si el aviso es sobre eso, confírmalo; si es sobre otra cosa, para y cuéntamelo.
5. Verifica y dime los valores (esperado: `col_infografia = 5`, `bucket_publico = true`, `limite_bytes = 5242880`, `politicas = 3`, `libros_con_infografia = 0`):
   ```sql
   select (select count(*) from information_schema.columns where table_name='libros' and column_name like 'infografia_%') col_infografia,
          (select public from storage.buckets where id='infografias') bucket_publico,
          (select file_size_limit from storage.buckets where id='infografias') limite_bytes,
          (select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'infografias_admin_%') politicas,
          (select count(*) from libros where infografia_url is not null) libros_con_infografia;
   ```

## FASE 2 — Abrir el PR y fusionarlo en `main`
1. Abre https://github.com/AFC1204-coder/Mf/compare/main...claude/mente-fria-daily-redesign-pt8obx
   Comprueba: base `main`, comparar `claude/mente-fria-daily-redesign-pt8obx`, "Able to merge" (sin conflictos). Debe mostrar unos **21 commits** y unos **37 archivos** cambiados (más de 5.000 líneas añadidas). Dime lo que ves. Si ya existe un PR abierto de esa rama, úsalo en vez de crear otro.
2. **Create pull request** con este título y descripción (pégala tal cual):
   - Título: `Rediseño para el uso diario: sesión de hoy, repaso sin deuda, navegación en cinco, onboarding, constancia semanal e infografías`
   - Descripción:

```
## Qué cambia
- **Sesión de hoy**: Recuerda → Lee → Comprueba → Lleva, con cierre «Hasta mañana», modo «Solo recordar» y lectura de 2 minutos o completa.
- **Repaso sin deuda**: solo entra lo leído; las 5.333 tarjetas nunca vistas quedan dormidas; curva de repaso de 1 a 90 días; la cola nunca pasa de 20.
- **Día hasta las 04:00**: leer a las 00:30 cuenta como la noche anterior; repasar también cuenta como día.
- **Navegación en cinco**: Hoy · Biblioteca · Repaso · Tú · Buscar.
- **Onboarding** de 3 preguntas, ruta activa que decide la lección del día, constancia semanal, resumen de la semana y mapa de dominios.
- **Infografías por libro** con revisión humana (pestaña nueva en admin.html) y generador lanzable desde GitHub Actions (simula por defecto).
- Rutas nuevas («Emociones y atención», «Economía básica»), motor de diagramas didácticos y rutas de aprendizaje.
- Sin avisos de culpa («Racha perdida», «N repasos pendientes»).
- Medición: eventos de uso y compromisos. Auditoría de los SVG antiguos (docs/auditoria-svg.md).

## Base de datos
Las migraciones están aplicadas en Supabase y son compatibles con la versión anterior: `supabase/migrations/20261010_quick_wins.sql`, `20261011_sesion_eventos.sql` y `20261012_infografias.sql`.

## Antes de usarlo
- Admin: `admin.html` usa Supabase Auth y exige estar en `public.admins` (ya hay un administrador dado de alta). La web pública no se ve afectada.

## Pruebas
- `npx vitest run`: 239 tests pasan.
- Probado en Chromium con ancho de móvil con datos simulados; falta probarlo con datos reales.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XATNwFgRdGmsMUvADBG84u
```
3. Mira el estado del PR (pestaña Checks) y dime si hay algo fallando. Normalmente no hay checks (el único workflow existente solo se activa al cambiar `changes.json`). Si GitHub exige revisión o aprobación que yo no tengo, **para y cuéntamelo**.
4. Fusiona con **"Create a merge commit"** (no Squash ni Rebase). NO borres la rama al terminar (ignora el botón "Delete branch").
5. Comprueba y dime: el último commit de `main` (mensaje y hash corto) y si en **Actions** apareció algún workflow nuevo y cómo terminó.

## FASE 3 — Secretos de GitHub
Hace falta que el workflow de infografías tenga tres secretos. **Los valores los pongo yo; tú solo abres las pantallas.**

1. En OpenAI (https://platform.openai.com), **solo navega**, no crees nada tú:
   - Abre la sección de límites de gasto (Settings → Organization → Limits, o el equivalente actual) y **dime** qué límite mensual tengo puesto. Si no hay ninguno, pídeme que lo ponga yo (recomendado: 10 $).
   - Abre API keys y **pídeme que cree yo una clave nueva** llamada `mente-fria-infografias`. Cuando yo te diga "copiada", no mires ni copies su valor.
2. Abre https://github.com/AFC1204-coder/Mf/settings/secrets/actions y comprueba qué secretos de repositorio existen ya (solo nombres). Dime cuáles.
3. Para cada uno de estos tres, pulsa **New repository secret**, escribe solo el **nombre** y **para para que yo pegue/escriba el valor**; cuando yo te diga "hecho", pulsa **Add secret**:
   - `OPENAI_API_KEY` (el valor: la clave de OpenAI que acabo de crear)
   - `ADMIN_EMAIL` (el valor: `[TU_EMAIL_ADMIN]`; este puedes escribirlo tú porque no es secreto)
   - `ADMIN_PASSWORD` (el valor: la contraseña del administrador; la escribo yo)
   Si alguno ya existe, no lo sobrescribas sin preguntarme.
4. Dime que los tres secretos aparecen en la lista (solo nombres, nunca valores).

## FASE 4 — Lanzar el workflow de infografías
(Requiere que la FASE 2 haya terminado bien: el workflow solo aparece en Actions cuando está en `main`.)

1. Abre https://github.com/AFC1204-coder/Mf/actions y busca el workflow **"Infografías de libros"**. Si no aparece, para y dímelo.
2. **Simulación primero (no gasta nada):** *Run workflow* en la rama `main` con "ejecutar" **sin marcar**, límite `3`, calidad `medium`, libro vacío y tope `3`. Espera a que termine, abre el log y dime: si terminó en verde, el modelo y la calidad que muestra, la línea "N de M libros pendientes · coste estimado ≈ $…", y los títulos de los 3 libros. **No copies el prompt completo; solo los títulos.**
   - Si la simulación falla, copia el mensaje de error (sin secretos) y para.
3. **PAUSA OBLIGATORIA.** Resume en una línea qué se va a generar y cuánto cuesta (se espera ≈ 0,15 $ para 3 libros en calidad media) y **pídeme confirmación explícita** ("¿lanzo la generación de 3 libros por ≈ 0,15 $?"). No continúes sin un "sí" mío.
4. Con mi "sí": *Run workflow* en `main` con "ejecutar" **marcado**, límite `3`, calidad `medium`, libro vacío y tope `3`. Espera a que termine y dime: resultado (verde/rojo), cuántas imágenes se generaron y cuántas fallaron, y los errores sin secretos. Errores previsibles y qué hacer:
   - "organization must be verified" / 403 de OpenAI: la organización necesita verificación; **para y dímelo, no intentes verificarla tú**.
   - "Faltan las columnas infografia_*": la FASE 1 no se aplicó; vuelve a ella.
   - Error de login de administrador: avísame (contraseña o email incorrectos); no lo reintentes más de una vez.
5. Comprueba en Supabase (SQL Editor, solo lectura) y dime el resultado (esperado tras una generación completa: `pendientes = 3`):
   ```sql
   select count(*) filter (where infografia_estado='pendiente') pendientes,
          count(*) filter (where infografia_estado='aprobada') aprobadas,
          count(*) filter (where infografia_estado='rechazada') rechazadas
   from libros;
   select count(*) objetos from storage.objects where bucket_id='infografias';
   ```
6. **No apruebes ni rechaces ninguna infografía y no inicies sesión en `admin.html`:** la revisión la hago yo.

## FASE 5 — (Opcional, independiente) Cerrar el registro público de usuarios
Hazla solo si las fases anteriores no te han dado problemas; si prefieres, déjala sin hacer y dímelo.
1. Abre Supabase → Authentication → Sign In / Providers (https://supabase.com/dashboard/project/aduizdiiacrvpoavjmab/auth/providers) y dime el estado actual del interruptor de **"Allow new users to sign up"**.
2. **Desactívalo** (para que nadie pueda crearse una cuenta con la clave pública) y guarda. No toques ningún otro ajuste de esa pantalla, ni el email, ni las plantillas.
3. Confirma el nuevo estado, y que el usuario administrador existente sigue en Authentication → Users (no lo modifiques).

## Informe final
Dime, en una lista corta, el estado de cada fase (hecha / parada y por qué), los números de las comprobaciones, y qué me queda por hacer a mí (por ejemplo: revisar las 3 infografías en `admin.html` → Infografías). No incluyas ninguna contraseña ni clave.

## MIGRACIÓN
```sql
-- Infografías por libro (docs/infografias.md).
-- Añade columnas a `libros`, el bucket público `infografias` y permisos de escritura solo para administradores.
-- No modifica datos existentes. Solo se muestran las infografías con estado 'aprobada'.

alter table libros
  add column if not exists infografia_url text,
  add column if not exists infografia_estado text,
  add column if not exists infografia_prompt text,
  add column if not exists infografia_modelo text,
  add column if not exists infografia_at timestamptz;

do $$ begin
  alter table libros add constraint libros_infografia_estado_chk
    check (infografia_estado is null or infografia_estado in ('pendiente','aprobada','rechazada'));
exception when duplicate_object then null; end $$;

create index if not exists libros_infografia_estado_idx on libros (infografia_estado) where infografia_estado is not null;

-- Bucket público de lectura (las imágenes se sirven por URL); 5 MB por archivo, solo imágenes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('infografias', 'infografias', true, 5242880, array['image/webp','image/png','image/jpeg'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Escritura solo para administradores (public.admins vía is_admin()).
do $$ begin
  create policy infografias_admin_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'infografias' and public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy infografias_admin_update on storage.objects for update to authenticated
    using (bucket_id = 'infografias' and public.is_admin())
    with check (bucket_id = 'infografias' and public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy infografias_admin_delete on storage.objects for delete to authenticated
    using (bucket_id = 'infografias' and public.is_admin());
exception when duplicate_object then null; end $$;
```
