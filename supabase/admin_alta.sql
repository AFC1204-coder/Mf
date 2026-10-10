-- Alta de administrador para admin.html (Supabase Auth + public.admins).
-- NO es una migración: se ejecuta a mano, una vez por administrador.
--
-- Antes: crea el usuario en Supabase → Authentication → Users → Add user → Create new user
--        (email + contraseña fuerte, con "Auto Confirm User" marcado).
-- Después: cambia el email de abajo y ejecuta este bloque en el SQL Editor.

do $$
declare
  v_email text := 'TU_EMAIL@EJEMPLO.COM';   -- <-- el mismo email que creaste en Authentication
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(v_email);
  if v_id is null then
    raise exception 'No existe ningún usuario con el email %. Créalo antes en Authentication → Users.', v_email;
  end if;

  insert into public.admins (user_id)
  select v_id
  where not exists (select 1 from public.admins where user_id = v_id);
end $$;

-- Comprobación: debe salir una fila con tu email.
select a.user_id, u.email, u.email_confirmed_at is not null as confirmado
from public.admins a join auth.users u on u.id = a.user_id;

-- Para quitar a un administrador (cambia el email):
-- delete from public.admins where user_id = (select id from auth.users where lower(email) = lower('TU_EMAIL@EJEMPLO.COM'));
