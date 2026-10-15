-- Recordatorio diario por Web Push (docs/notificaciones.md). Solo crea tablas y una vista nuevas.
-- Aplicar ANTES de desplegar la Edge Function. El cron se programa aparte (supabase/push_cron.sql).

-- Un dispositivo = una suscripción. El cliente guarda además la lección que toca hoy
-- (la calcula la app) para que el aviso lleve la idea del día sin que el servidor conozca tu progreso.
create table if not exists push_suscripciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id text not null default 'default',
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  hora text not null default '21:30' check (hora ~ '^[0-2][0-9]:[0-5][0-9]$'),
  activo boolean not null default true,
  frecuencia text not null default 'diaria' check (frecuencia in ('diaria','semanal')),
  avisos_ignorados int not null default 0,
  proxima_leccion_id uuid,
  proxima_titulo text,
  proxima_idea text,
  user_agent text,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now()
);

-- Cada aviso enviado, para medir si lleva a una sesión (< 2 h) y para decidir la frecuencia.
create table if not exists push_avisos (
  id uuid primary key default gen_random_uuid(),
  suscripcion_id uuid not null references push_suscripciones(id) on delete cascade,
  enviado timestamptz not null default now(),
  dia date not null,                          -- día lógico (corte 04:00, Europe/Madrid)
  leccion_id uuid,
  abierto timestamptz,                        -- lo marca la app al abrirse desde el aviso
  evaluado boolean not null default false,
  respondido boolean,                         -- hubo sesión_cerrada ese día
  sesion_en_2h boolean
);
create index if not exists push_avisos_susc_idx on push_avisos (suscripcion_id, enviado desc);

-- RLS activada (a diferencia de eventos/compromisos). La app usa la clave anónima: puede
-- registrar y actualizar su suscripción y marcar un aviso como abierto. Con el endpoint solo
-- no se puede enviar nada: hace falta la clave privada VAPID, que vive en los secretos de la función.
alter table push_suscripciones enable row level security;
alter table push_avisos enable row level security;
drop policy if exists push_susc_anon on push_suscripciones;
create policy push_susc_anon on push_suscripciones for all to anon, authenticated using (true) with check (true);
drop policy if exists push_avisos_leer on push_avisos;
create policy push_avisos_leer on push_avisos for select to anon, authenticated using (true);
drop policy if exists push_avisos_abrir on push_avisos;
create policy push_avisos_abrir on push_avisos for update to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on push_suscripciones to anon, authenticated;
grant select on push_avisos to anon, authenticated;
grant update (abierto) on push_avisos to anon, authenticated;

-- Eficacia: de los avisos evaluados, cuántos llevaron a una sesión ese día y en < 2 h.
create or replace view v_avisos_eficacia as
  select date_trunc('week', dia)::date semana,
         count(*) filter (where evaluado) evaluados,
         count(*) filter (where respondido) con_sesion_ese_dia,
         count(*) filter (where sesion_en_2h) con_sesion_en_2h,
         round(100.0 * count(*) filter (where sesion_en_2h) / nullif(count(*) filter (where evaluado), 0)) pct_en_2h
  from push_avisos group by 1 order by 1;

-- Lectura de secretos del Vault para la Edge Function (claves VAPID y secreto del cron).
-- Solo la puede ejecutar service_role; la app (anon) no tiene acceso.
create or replace function public.push_secreto(nombre text) returns text
language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = nombre limit 1
$$;
revoke all on function public.push_secreto(text) from public, anon, authenticated;
grant execute on function public.push_secreto(text) to service_role;
