-- Revierte 20261104_cuenta_obligatoria.sql: vuelve a las políticas anteriores (acceso con la clave pública, usuario «default»).
do $$
declare t text; p record;
begin
  foreach t in array array['compromisos','estado_lectura','favoritos_usuario','notas','perfil_usuario','repaso',
                           'respuestas_reto','revisiones_reto','progreso','sesiones','subrayados',
                           'notificaciones','push_avisos','push_suscripciones']
  loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

create policy compromisos_dueno on public.compromisos for all to anon, authenticated using (usuario_id = 'default') with check (usuario_id = 'default');
create policy estado_lectura_dueno on public.estado_lectura for all to anon, authenticated using (usuario_id = 'default') with check (usuario_id = 'default');
create policy favoritos_dueno on public.favoritos_usuario for all to anon, authenticated using (usuario_id = 'default') with check (usuario_id = 'default');
create policy notas_dueno on public.notas for all to anon, authenticated using (usuario_id = 'default') with check (usuario_id = 'default');
create policy perfil_usuario_dueno on public.perfil_usuario for all to anon, authenticated using (usuario_id = 'default') with check (usuario_id = 'default');
create policy repaso_dueno on public.repaso for all to anon, authenticated using (usuario_id = 'default') with check (usuario_id = 'default');
create policy respuestas_reto_dueno on public.respuestas_reto for all to anon, authenticated using (usuario_id = 'default') with check (usuario_id = 'default');
create policy revisiones_reto_dueno on public.revisiones_reto for all to anon, authenticated using (usuario_id = 'default') with check (usuario_id = 'default');

create policy escritura_progreso on public.progreso for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy progreso_own on public.progreso for all to public
  using ((usuario_id = coalesce((auth.uid())::text, 'default')) or (usuario_id = 'default'))
  with check (usuario_id = coalesce((auth.uid())::text, 'default'));
create policy escritura_sesiones on public.sesiones for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy sesiones_own on public.sesiones for all to public
  using ((usuario_id = coalesce((auth.uid())::text, 'default')) or (usuario_id = 'default'))
  with check (usuario_id = coalesce((auth.uid())::text, 'default'));
create policy subrayados_own on public.subrayados for all to public
  using ((usuario_id = coalesce((auth.uid())::text, 'default')) or (usuario_id = 'default'))
  with check (usuario_id = coalesce((auth.uid())::text, 'default'));

create policy notif_insert_anon on public.notificaciones for insert to public with check (true);
create policy notif_select_anon on public.notificaciones for select to public using (true);
create policy notif_update_anon on public.notificaciones for update to public using (true);
create policy push_avisos_abrir on public.push_avisos for update to anon, authenticated using (true) with check (true);
create policy push_avisos_leer on public.push_avisos for select to anon, authenticated using (true);
create policy push_susc_anon on public.push_suscripciones for all to anon, authenticated using (true) with check (true);

drop policy if exists eventos_insertar on public.eventos;
create policy eventos_insertar on public.eventos for insert to anon, authenticated with check (usuario_id = 'default');
drop policy if exists reportes_dueno on public.reportes_contenido;
create policy reportes_select on public.reportes_contenido for select to public using (true);
grant execute on function public.set_portada(uuid, text) to anon, authenticated, service_role;
