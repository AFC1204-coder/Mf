-- Cuenta obligatoria (fase 3 de docs/cuenta.md): los datos personales solo los lee y escribe la cuenta del dueño.
-- Antes cualquiera con la clave pública de la app podía leerlos o escribirlos (políticas «usuario_id = 'default'» para anon).
-- «Dueño» = is_admin() (tabla admins; hoy solo alejandrofrutos1204@gmail.com). El contenido (libros, lecciones,
-- preguntas, retos activos, escenarios) sigue siendo de lectura pública. Revertir: 20261104_cuenta_obligatoria_revertir.sql.
-- Las funciones de servidor (cron de recordatorios) usan service_role y no pasan por estas políticas.

do $$
declare t text; p record;
begin
  -- 1) Tablas personales con usuario_id: una sola política, solo el dueño autenticado.
  foreach t in array array['compromisos','estado_lectura','favoritos_usuario','notas','perfil_usuario','repaso',
                           'respuestas_reto','revisiones_reto','progreso','sesiones','subrayados']
  loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format($f$create policy %I on public.%I for all to authenticated
      using (public.is_admin() and usuario_id = 'default') with check (public.is_admin() and usuario_id = 'default')$f$,
      t || '_dueno', t);
  end loop;

  -- 2) Tablas de avisos y suscripciones push: solo el dueño autenticado.
  foreach t in array array['notificaciones','push_avisos','push_suscripciones']
  loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format($f$create policy %I on public.%I for all to authenticated
      using (public.is_admin()) with check (public.is_admin())$f$, t || '_dueno', t);
  end loop;
end $$;

-- 3) Eventos: insertar solo con sesión del dueño (leer y borrar ya eran de admin).
drop policy if exists eventos_insertar on public.eventos;
create policy eventos_insertar on public.eventos for insert to authenticated
  with check (public.is_admin() and usuario_id = 'default');

-- 4) Avisos «¿Algo no cuadra?»: quien abre un enlace compartido (sin cuenta) puede seguir enviándolos,
--    pero solo el dueño los lee y gestiona.
drop policy if exists reportes_select on public.reportes_contenido;
create policy reportes_dueno on public.reportes_contenido for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 5) La portada de un libro solo la fija una sesión iniciada (antes, cualquiera con la clave pública).
revoke execute on function public.set_portada(uuid, text) from anon, public;
grant execute on function public.set_portada(uuid, text) to authenticated, service_role;
