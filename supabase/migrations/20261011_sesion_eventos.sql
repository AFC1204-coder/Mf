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
