# Prompt para Claude en Chrome — migración de infografías

Copia todo lo que hay debajo de la línea y pégalo en Claude en Chrome.
Antes, inicia sesión en Supabase en esa pestaña (no le des tus credenciales a Claude).

---

Necesito que apliques una migración SQL en mi proyecto de Supabase "Mente fría" (ref `aduizdiiacrvpoavjmab`) usando el SQL Editor del panel. Hazlo tú en el navegador, paso a paso.

## Reglas
- Trabaja solo en este proyecto y solo en el SQL Editor. No cambies ajustes, claves, autenticación ni otras tablas.
- Si te pide iniciar sesión, para y avísame; yo me identifico.
- Si aparece un aviso de "operación potencialmente destructiva" o de Row Level Security, léelo: esta migración solo añade columnas a `libros`, crea el bucket público `infografias` y 3 políticas de escritura en `storage.objects` limitadas a administradores. Si el aviso es sobre esas políticas o sobre añadir columnas, confírmalo; si es sobre otra cosa distinta, para y cuéntamelo.
- Si algo no coincide con lo descrito (otro proyecto, errores de sintaxis, el bucket ya existe con otro contenido), para y cuéntamelo antes de seguir.

## Pasos
1. Abre https://supabase.com/dashboard/project/aduizdiiacrvpoavjmab/sql/new y comprueba que el proyecto es el de Mente fría.
2. Comprobación previa (debe dar `col_infografia = 0` y `bucket = 0`; si ya dan 1 o más, para y avísame):
   ```sql
   select (select count(*) from information_schema.columns where table_name='libros' and column_name like 'infografia_%') col_infografia,
          (select count(*) from storage.buckets where id='infografias') bucket;
   ```
3. Selecciona todo el contenido del editor y bórralo. Pega el SQL completo del bloque "MIGRACIÓN" de más abajo, tal cual, sin modificar nada. Comprueba que se pegó entero (la última línea es `exception when duplicate_object then null; end $$;`). Si el editor corta o desordena el texto, pégalo por partes siguiendo los comentarios y ejecútalas en orden.
4. Pulsa **Run**. Debe decir "Success" sin errores. Si hay error, copia el mensaje completo y para.
5. Verifica y dime los valores:
   ```sql
   select (select count(*) from information_schema.columns where table_name='libros' and column_name like 'infografia_%') col_infografia,
          (select public from storage.buckets where id='infografias') bucket_publico,
          (select file_size_limit from storage.buckets where id='infografias') limite_bytes,
          (select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'infografias_admin_%') politicas,
          (select count(*) from libros where infografia_url is not null) libros_con_infografia;
   ```
   Esperado: `col_infografia = 5`, `bucket_publico = true`, `limite_bytes = 5242880`, `politicas = 3`, `libros_con_infografia = 0`.
6. Dime en una lista corta qué pasó en cada paso y los valores de las comprobaciones.

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
