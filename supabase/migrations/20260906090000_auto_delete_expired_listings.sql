-- Automatically removes active listings the day after their event date, at
-- 02:00 Stockholm time, so the feed doesn't fill up with expired tickets.
-- Sold listings are left alone (kept for the profile "sold" history / any
-- ratings tied to them).
--
-- Run this once in the Supabase SQL editor. If it fails with a permissions
-- error on "create extension pg_cron", first enable pg_cron via Database ->
-- Extensions in the Supabase dashboard, then re-run this file.
create extension if not exists pg_cron with schema extensions;

create or replace function public.delete_expired_listings()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- The job runs hourly; only act during the 02:00 Stockholm-time hour so
  -- this doesn't depend on rescheduling the cron entry for DST twice a year.
  if extract(hour from (now() at time zone 'Europe/Stockholm')) != 2 then
    return;
  end if;

  delete from public.listings
  where status = 'active'
    and event_date is not null
    and event_date < (now() at time zone 'Europe/Stockholm')::date;
end;
$$;

revoke all on function public.delete_expired_listings() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'delete-expired-listings') then
    perform cron.unschedule('delete-expired-listings');
  end if;
end $$;

select cron.schedule('delete-expired-listings', '0 * * * *', $$select public.delete_expired_listings();$$);
