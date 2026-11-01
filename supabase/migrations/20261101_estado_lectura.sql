-- Lo «reciente» que antes vivía solo en cada navegador: última lección leída, últimos libros e hilo de la noche.
-- Cada campo lleva su propia marca de tiempo (ts) dentro del json: gana el más reciente al sincronizar (lib/estado.js).
create table if not exists public.estado_lectura (
  usuario_id text primary key,
  ultima jsonb,
  ultimos jsonb,
  hilo jsonb,
  actualizado_at timestamptz not null default now()
);
alter table public.estado_lectura enable row level security;
-- Misma regla que el resto de tablas personales hoy (usuario único «default»).
create policy estado_lectura_dueno on public.estado_lectura
  for all to anon, authenticated
  using (usuario_id = 'default')
  with check (usuario_id = 'default');
