-- Tiempo real de lectura: segundos con una lección a la vista, por lección y día.
-- Lo escribe la app (solo cuenta si la lección está en pantalla, la pestaña visible y hubo interacción reciente).
-- Una fila por (usuario, lección, día lógico); la app guarda el total acumulado del día.

create table if not exists public.tiempo_lectura (
  usuario_id text not null default 'default',
  leccion_id uuid not null references public.lecciones(id) on delete cascade,
  dia date not null,
  segundos integer not null check (segundos between 0 and 86400),
  actualizado timestamptz not null default now(),
  primary key (usuario_id, leccion_id, dia)
);
create index if not exists tiempo_lectura_dia_idx on public.tiempo_lectura(usuario_id, dia);

alter table public.tiempo_lectura enable row level security;
drop policy if exists tiempo_lectura_dueno on public.tiempo_lectura;
create policy tiempo_lectura_dueno on public.tiempo_lectura for all to authenticated
  using (public.is_admin() and usuario_id = 'default') with check (public.is_admin() and usuario_id = 'default');
revoke all on public.tiempo_lectura from anon;
grant select, insert, update, delete on public.tiempo_lectura to authenticated;
