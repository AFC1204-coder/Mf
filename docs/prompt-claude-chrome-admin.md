# Prompt para Claude en Chrome — crear tu usuario administrador

Antes de pegarlo: sustituye `[TU_EMAIL]` (aparece 3 veces) por el email con el que quieres entrar a `admin.html`.
Inicia sesión en Supabase en esa pestaña (no le des tus credenciales a Claude).
La contraseña la escribes tú cuando Claude te la pida: no se la des a Claude ni la pegues en el chat.

---

Necesito que me crees un usuario administrador en mi proyecto de Supabase "Mente fría" (ref `aduizdiiacrvpoavjmab`) y lo des de alta como administrador. Hazlo tú en el navegador, paso a paso.

El email del administrador es: `[TU_EMAIL]`

## Reglas
- Trabaja solo en este proyecto: Authentication → Users y SQL Editor. No cambies ajustes de Authentication (registro público, proveedores, plantillas de correo), claves, ni otras tablas.
- **Nunca inventes, generes, veas ni escribas la contraseña.** Cuando llegues al campo de contraseña, para y pídeme que la escriba yo en el navegador; espera a que te diga "hecho" y continúa. No me pidas que te la dicte ni la copies en el chat.
- Si te pide iniciar sesión, para y avísame; yo me identifico.
- Si algo no coincide con lo descrito (otro proyecto, el usuario ya existe, errores), para y cuéntamelo antes de seguir.
- No intentes iniciar sesión en `admin.html`: eso lo hago yo.

## Pasos
1. Abre https://supabase.com/dashboard/project/aduizdiiacrvpoavjmab/auth/users y comprueba que el proyecto es el de Mente fría. Dime cuántos usuarios hay (se espera 0) y si ya existe uno con el email `[TU_EMAIL]` (si existe, para y avísame).
2. Pulsa **Add user → Create new user**. Escribe el email `[TU_EMAIL]`. En el campo de contraseña, **para y pídeme que la escriba yo** (que sea larga y única). Marca **Auto Confirm User**. Cuando yo te diga "hecho", pulsa **Create user**.
3. Comprueba que el usuario aparece en la lista, con el email correcto y confirmado (sin "Waiting for verification"). Dime qué ves.
4. Abre https://supabase.com/dashboard/project/aduizdiiacrvpoavjmab/sql/new , selecciona todo el contenido del editor y bórralo. Pega este SQL tal cual, cambiando solo `[TU_EMAIL]` por el email real, y pulsa **Run**:

```sql
do $$
declare
  v_email text := '[TU_EMAIL]';
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
```
   Debe decir "Success. No rows returned". Si da error, copia el mensaje completo y para.
5. Verifica con esta consulta y dime el resultado (debe salir exactamente una fila con ese email y `confirmado = true`):

```sql
select a.user_id, u.email, u.email_confirmed_at is not null as confirmado
from public.admins a join auth.users u on u.id = a.user_id;
```
6. Comprueba también (no modifica nada) que la función de comprobación existe: 

```sql
select (select count(*) from pg_proc where proname = 'is_admin') funcion_is_admin,
       (select count(*) from public.admins) administradores;
```
   Esperado: `funcion_is_admin = 1` y `administradores = 1`.
7. Dime en una lista corta qué pasó en cada paso y el resultado de las comprobaciones. No incluyas la contraseña ni nada parecido.
