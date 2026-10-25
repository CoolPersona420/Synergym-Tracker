-- Workout reminders: the schedule. Run once in the Supabase SQL editor after the app is deployed.
--
-- 1. Generate a long random secret (for example: openssl rand -hex 32). Never commit it.
-- 2. Store it in Vault under the name the database functions look for:
--      select vault.create_secret('<the secret>', 'reminder_secret', 'Shared with api/reminders.js');
-- 3. Set the same value as REMINDER_SECRET in Vercel, along with VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
--    (npx web-push generate-vapid-keys). The public key must also match VAPID_PUBLIC in src/lib/push.js.
-- 4. Run the statements below (replace the URL if the app lives elsewhere).

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- every 5 minutes, ask the app's reminders function to send whatever is due
select cron.unschedule('synergym-reminders') where exists (select 1 from cron.job where jobname = 'synergym-reminders');
select cron.schedule('synergym-reminders', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://synergym-tracker-log.vercel.app/api/reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000)
$$);
