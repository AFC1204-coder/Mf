# Prompt para Claude en Chrome — migración de la sesión de hoy (eventos y compromisos)

Copia todo lo que hay debajo de la línea y pégalo en Claude en Chrome.
Antes, inicia sesión en Supabase en esa pestaña (no le des tus credenciales a Claude).

---

Necesito que apliques una migración SQL en mi proyecto de Supabase "Mente fría" (ref `aduizdiiacrvpoavjmab`) usando el SQL Editor del panel. Hazlo tú en el navegador, paso a paso.

## Reglas
- Trabaja solo en este proyecto y solo en el SQL Editor. No cambies ajustes, claves, autenticación ni otras tablas.
- Si te pide iniciar sesión, para y avísame; yo me identifico.
- Si aparece un aviso de "operación potencialmente destructiva", revisa que es esperado (esta migración solo crea tablas y vistas nuevas y concede permisos) y confirma solo ese aviso.
- Si algo no coincide con lo descrito (otro proyecto, errores de sintaxis, tablas que ya existen con otro contenido), para y cuéntamelo antes de seguir.

## Qué hace la migración
No modifica ni borra datos existentes. Crea las tablas `eventos` y `compromisos`, sus índices, los permisos para la clave anónima de la app, y dos vistas de métricas (`v_dias_activos` y `v_sesiones_dia`).

## Pasos
1. Abre https://supabase.com/dashboard/project/aduizdiiacrvpoavjmab/sql/new y comprueba que el nombre del proyecto es el de Mente fría.
2. Antes de nada, ejecuta esta comprobación y dime el resultado (debe dar `eventos = null` y `compromisos = null`; si ya existen, para y avísame):
   ```sql
   select to_regclass('public.eventos') eventos, to_regclass('public.compromisos') compromisos;
   ```
3. Selecciona todo el contenido del editor y bórralo. Pega el SQL completo del bloque "MIGRACIÓN" de más abajo, tal cual, sin modificar nada. Comprueba que se pegó entero (la última línea es `from eventos group by usuario_id, dia;`). Si el editor corta o desordena el texto, pégalo por partes siguiendo los comentarios `-- ──` y ejecútalas en orden.
4. Pulsa **Run** y espera. Debe decir "Success" sin errores. Si hay un error, copia el mensaje completo y para.
5. Verifica con esta consulta y dime los valores:
   ```sql
   select
     to_regclass('public.eventos') eventos,
     to_regclass('public.compromisos') compromisos,
     (select count(*) from information_schema.views where table_schema='public' and table_name in ('v_dias_activos','v_sesiones_dia')) vistas,
     (select count(*) from eventos) filas_eventos,
     (select count(*) from compromisos) filas_compromisos,
     has_table_privilege('anon','public.eventos','INSERT') anon_inserta_eventos,
     has_table_privilege('anon','public.compromisos','UPDATE') anon_actualiza_compromisos;
   ```
   Esperado: `eventos` y `compromisos` con su nombre (no null), `vistas = 2`, `filas_eventos = 0`, `filas_compromisos = 0`, y los dos permisos en `true`.
6. Prueba las vistas (no modifican nada):
   ```sql
   select (select count(*) from v_dias_activos) dias_activos, (select count(*) from v_sesiones_dia) sesiones;
   ```
   `dias_activos` debe ser un número mayor que 0 (viene del historial de lecturas y repasos) y `sesiones` debe ser 0.
7. Dime en una lista corta qué pasó en cada paso y los valores de las comprobaciones.

## MIGRACIÓN
```sql
-- Sesión de hoy (docs/rediseno-uso-diario.md §3, §10): eventos de medición y compromisos.
-- Solo crea tablas nuevas y vistas; no toca datos existentes.

-- ── Eventos: línea base de uso (sin contenido personal) ──
create table if not exists eventos (
  id bigserial primary key,
  usuario_id text not null default 'default',
  ts timestamptz not null default now(),
  dia date not null,                       -- día lógico (corte 04:00), lo calcula el cliente
  tipo text not null,                      -- app_abierta · sesion_inicio · paso_hecho · sesion_cerrada · leccion_leida · tarjeta
  props jsonb not null default '{}'::jsonb
);
create index if not exists eventos_usuario_dia_idx on eventos (usuario_id, dia);
create index if not exists eventos_tipo_ts_idx on eventos (tipo, ts);

-- ── Compromisos: la acción que te llevas de una lección ──
create table if not exists compromisos (
  id uuid primary key default gen_random_uuid(),
  usuario_id text not null default 'default',
  leccion_id uuid references lecciones(id) on delete set null,
  texto text not null,
  para date not null,                      -- día en que se pregunta «¿lo hiciste?»
  resultado text check (resultado in ('si','a_medias','no')),
  created_at timestamptz not null default now(),
  respondido_at timestamptz
);
create index if not exists compromisos_pendientes_idx on compromisos (usuario_id, para) where resultado is null;

-- Misma política que el resto de tablas de la app (acceso con la clave anónima).
grant select, insert, update on eventos, compromisos to anon, authenticated;
grant usage, select on sequence eventos_id_seq to anon, authenticated;

-- ── Vistas de métricas ──
-- Días con actividad por semana (lecturas, repasos y sesiones).
create or replace view v_dias_activos as
  select usuario_id, dia from (
    select usuario_id, ((fecha at time zone 'Europe/Madrid') - interval '4 hours')::date dia from progreso where fecha is not null
    union
    select usuario_id, ((ultima_revision at time zone 'Europe/Madrid') - interval '4 hours')::date from repaso where ultima_revision is not null
    union
    select usuario_id, dia from eventos where tipo in ('sesion_cerrada','tarjeta','leccion_leida')
  ) x group by usuario_id, dia;

-- Sesiones empezadas y cerradas por día (tasa de finalización).
create or replace view v_sesiones_dia as
  select usuario_id, dia,
         count(*) filter (where tipo = 'sesion_inicio')  empezadas,
         count(*) filter (where tipo = 'sesion_cerrada') cerradas,
         round(avg((props->>'segundos')::numeric) filter (where tipo = 'sesion_cerrada')) segundos_medios
  from eventos group by usuario_id, dia;
```
