-- Cola de libros candidatos para la incorporación autónoma de libros (docs/libros-preceptos.md).
-- La rutina semanal elige de aquí (no improvisa), deja constancia del resultado y respeta el tope semanal
-- contando solo lo publicado por ella (antes contaba cualquier libro reciente, incluidas cargas masivas).
-- Solo la leen/escriben service_role y el panel de Supabase: sin políticas (RLS activada, sin acceso para anon/authenticated).
create table if not exists public.libros_candidatos (
  id               uuid primary key default gen_random_uuid(),
  titulo           text not null,
  autor            text not null,
  eje_principal    text not null check (eje_principal in ('Pensamiento y Civilización','Psicología y Conducta','Economía y Mercados','Neurociencia y Biología','Desarrollo Humano')),
  sub_eje          text,
  motivo           text,                                   -- por qué es útil para esta biblioteca
  prioridad        int  not null default 50 check (prioridad between 0 and 100),
  estado           text not null default 'pendiente' check (estado in ('pendiente','en_curso','publicado','en_revision','descartado')),
  origen           text not null default 'usuario',        -- usuario | rutina | sesion
  libro_id         uuid references public.libros(id) on delete set null,
  veredicto_puerta text,                                   -- publicar | revisar | rechazar (resultado de tools/libros/puerta.js)
  informe          jsonb,                                  -- motivos de la puerta, hallazgos de los verificadores
  creado           timestamptz not null default now(),
  actualizado      timestamptz not null default now(),
  publicado_en     timestamptz
);
create unique index if not exists libros_candidatos_uq on public.libros_candidatos (lower(titulo), lower(autor));
alter table public.libros_candidatos enable row level security;
