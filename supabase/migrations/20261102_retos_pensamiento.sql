-- Retos de pensamiento: sustituyen al test de cada lección (las tablas preguntas/repaso no se tocan).
-- retos: contenido (uno principal por lección). respuestas_reto: lo que escribe el usuario + su repaso.

create table if not exists public.retos (
  id uuid primary key default gen_random_uuid(),
  leccion_id uuid not null references public.lecciones(id) on delete cascade,
  libro_id uuid not null references public.libros(id) on delete cascade,
  tipo text not null check (tipo in ('predecir','primeros_principios','choque','otra_cara','vida_real')),
  texto text not null check (length(texto) between 40 and 700),
  -- solo para 'choque': la lección de otro autor con la que se enfrenta
  leccion_contraste_id uuid references public.lecciones(id) on delete set null,
  activo boolean not null default false,
  fecha_creacion timestamptz not null default now(),
  constraint retos_una_por_leccion unique (leccion_id),
  constraint retos_choque_con_contraste check (tipo <> 'choque' or leccion_contraste_id is not null)
);
create index if not exists retos_libro_idx on public.retos(libro_id);

create table if not exists public.respuestas_reto (
  id uuid primary key default gen_random_uuid(),
  usuario_id text not null default 'default',
  reto_id uuid references public.retos(id) on delete set null,   -- null en «Explícalo» (no tiene reto)
  leccion_id uuid not null references public.lecciones(id) on delete cascade,
  tipo text not null check (tipo in ('predecir','primeros_principios','choque','otra_cara','vida_real','explicalo')),
  texto text not null check (length(btrim(texto)) between 1 and 2000),
  creada_at timestamptz not null default now(),
  -- repaso: «¿sigues pensando lo mismo?» (no predicciones) con intervalos crecientes
  nivel integer not null default 0,
  proxima_revision timestamptz not null,
  ultima_revision timestamptz,
  -- solo predicciones: resultado cuando se cumple el plazo
  resultado text check (resultado in ('acerto','fallo','a_medias','aun_no')),
  resuelta_at timestamptz,
  constraint resultado_solo_predicciones check (resultado is null or tipo = 'predecir')
);
create index if not exists respuestas_reto_leccion_idx on public.respuestas_reto(usuario_id, leccion_id, creada_at desc);
create index if not exists respuestas_reto_cola_idx on public.respuestas_reto(usuario_id, proxima_revision);

-- Cada vez que se contesta «¿sigues pensando lo mismo?» queda constancia (y el texto nuevo, si cambia de opinión).
create table if not exists public.revisiones_reto (
  id uuid primary key default gen_random_uuid(),
  usuario_id text not null default 'default',
  respuesta_id uuid not null references public.respuestas_reto(id) on delete cascade,
  fecha timestamptz not null default now(),
  veredicto text not null check (veredicto in ('igual','matizo','cambio')),
  texto text
);
create index if not exists revisiones_reto_resp_idx on public.revisiones_reto(respuesta_id, fecha);

alter table public.retos enable row level security;
alter table public.respuestas_reto enable row level security;
alter table public.revisiones_reto enable row level security;

-- Contenido: lectura pública (solo retos activos); escritura solo admin.
drop policy if exists retos_lectura on public.retos;
create policy retos_lectura on public.retos for select to anon, authenticated using (activo);
drop policy if exists retos_admin on public.retos;
create policy retos_admin on public.retos for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Datos personales: igual que el resto de tablas personales por ahora (usuario único «default»);
-- la fase de cuenta obligatoria las cerrará todas a la vez.
drop policy if exists respuestas_reto_dueno on public.respuestas_reto;
create policy respuestas_reto_dueno on public.respuestas_reto for all to anon, authenticated
  using (usuario_id = 'default') with check (usuario_id = 'default');
drop policy if exists revisiones_reto_dueno on public.revisiones_reto;
create policy revisiones_reto_dueno on public.revisiones_reto for all to anon, authenticated
  using (usuario_id = 'default') with check (usuario_id = 'default');

grant select on public.retos to anon, authenticated;
grant all on public.respuestas_reto, public.revisiones_reto to anon, authenticated;
