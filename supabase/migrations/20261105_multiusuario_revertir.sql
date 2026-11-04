-- Revierte 20261105_multiusuario.sql: vuelve a que los datos personales sean solo del dueño (is_admin() y 'default').
do $$
declare t text;
begin
  foreach t in array array['compromisos','estado_lectura','favoritos_usuario','notas','perfil_usuario','repaso',
                           'respuestas_reto','revisiones_reto','progreso','sesiones','subrayados','tiempo_lectura']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_propio', t);
    execute format('drop policy if exists %I on public.%I', t || '_dueno', t);
    execute format($f$create policy %I on public.%I for all to authenticated
      using (public.is_admin() and usuario_id = 'default') with check (public.is_admin() and usuario_id = 'default')$f$,
      t || '_dueno', t);
  end loop;
  drop policy if exists notificaciones_propio on public.notificaciones;
  drop policy if exists notificaciones_dueno on public.notificaciones;
  create policy notificaciones_dueno on public.notificaciones for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
end $$;
drop policy if exists eventos_insertar on public.eventos;
create policy eventos_insertar on public.eventos for insert to authenticated
  with check (public.is_admin() and usuario_id = 'default');
drop function if exists public.mi_usuario();
drop table if exists public.miembros;
