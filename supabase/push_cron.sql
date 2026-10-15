-- Programa la Edge Function «enviar-recordatorios» cada 15 minutos.
-- NO es una migración: se ejecuta a mano UNA vez, después de
--   1) aplicar 20261014_push_recordatorios.sql,
--   2) desplegar la función y crear sus secretos (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET),
--   3) guardar en Vault la URL del proyecto y CRON_SECRET (más abajo).
-- Para comprobarlo sin enviar nada, llama a la función con ?dry=1.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- select vault.create_secret('https://<ref>.supabase.co', 'proyecto_url');
-- select vault.create_secret('<el mismo CRON_SECRET que la función>', 'cron_secret');

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
