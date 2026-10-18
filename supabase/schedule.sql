-- Run after configuring Vault secrets in the Supabase dashboard.
-- Vault names: devcity_function_url = https://PROJECT.supabase.co/functions/v1/sync-github
-- devcity_sync_secret = same random secret as Edge Function SYNC_SECRET.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$ begin if exists(select 1 from cron.job where jobname='devcity-sync') then perform cron.unschedule('devcity-sync');end if;end $$;
select cron.schedule('devcity-sync','17 * * * *',$job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='devcity_function_url'),
  headers:=jsonb_build_object('Content-Type','application/json','x-sync-secret',(select decrypted_secret from vault.decrypted_secrets where name='devcity_sync_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=120000
 );
$job$);
