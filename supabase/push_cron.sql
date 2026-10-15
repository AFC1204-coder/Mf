-- Programa la Edge Function «enviar-recordatorios» cada 15 minutos.
-- NO es una migración: se ejecuta a mano UNA vez, después de
--   1) aplicar 20261014_push_recordatorios.sql,
--   2) guardar en Vault: vapid_publica, vapid_privada, vapid_subject, cron_secret y proyecto_url (más abajo),
--   3) desplegar la función.
-- Para comprobarlo sin enviar nada, llama a la función con ?dry=1.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- select vault.create_secret('https://<ref>.supabase.co', 'proyecto_url');
-- select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_secret');
-- select vault.create_secret('<clave pública VAPID>', 'vapid_publica');
-- select vault.create_secret('<clave privada VAPID>', 'vapid_privada');
-- select vault.create_secret('https://afc1204-coder.github.io/Mf/', 'vapid_subject');

select cron.schedule(
  'enviar-recordatorios',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'proyecto_url') || '/functions/v1/enviar-recordatorios',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Para quitarlo:  select cron.unschedule('enviar-recordatorios');
