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
