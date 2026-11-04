-- Varios usuarios (p. ej. la madre del dueño) con su progreso aparte.
-- Antes: los datos personales eran solo del dueño (is_admin() y usuario_id = 'default').
-- Ahora: cada fila es de un «usuario de datos» y cada cuenta solo ve y escribe el suyo:
--   · el dueño (is_admin()) sigue siendo 'default' → sus datos no cambian de sitio;
--   · el resto de cuentas, solo si están en `miembros` (las da de alta el dueño), usan su propio id de cuenta (auth.uid()).
--   · una cuenta que no sea dueña ni miembro no ve ni escribe nada personal (el contenido sigue siendo público).
-- Las funciones de repaso son SECURITY INVOKER, así que respetan estas políticas aunque se les pase otro p_usuario.
-- Los avisos push (push_avisos, push_suscripciones) siguen siendo solo del dueño. Revertir: 20261105_multiusuario_revertir.sql.

create table if not exists public.miembros (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email   text,
  creado  timestamptz not null default now()
);
alter table public.miembros enable row level security;     -- sin políticas: solo service_role / panel de Supabase

create or replace function public.mi_usuario() returns text
language sql stable security definer set search_path = public, auth as $$
  select case
    when public.is_admin() then 'default'
    when exists (select 1 from public.miembros m where m.user_id = auth.uid()) then auth.uid()::text
    else null
  end
$$;
revoke execute on function public.mi_usuario() from public, anon;
grant  execute on function public.mi_usuario() to authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array['compromisos','estado_lectura','favoritos_usuario','notas','perfil_usuario','repaso',
                           'respuestas_reto','revisiones_reto','progreso','sesiones','subrayados','tiempo_lectura','notificaciones']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_dueno', t);
    execute format('drop policy if exists %I on public.%I', t || '_propio', t);
    execute format($f$create policy %I on public.%I for all to authenticated
      using (usuario_id = (select public.mi_usuario())) with check (usuario_id = (select public.mi_usuario()))$f$,
      t || '_propio', t);
  end loop;
end $$;

-- Eventos: cada cuenta inserta los suyos (leer y borrar siguen siendo del dueño).
drop policy if exists eventos_insertar on public.eventos;
create policy eventos_insertar on public.eventos for insert to authenticated
  with check (usuario_id = (select public.mi_usuario()));
