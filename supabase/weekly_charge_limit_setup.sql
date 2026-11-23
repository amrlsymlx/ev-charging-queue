-- Optional "one charge per plate per 7 days" rule for customers, toggled by a
-- manager (Settings tab -> "Weekly Charge Limit"). When enabled, a plate that
-- has had a charging session (status active or completed; cancelled sessions
-- don't count) start within the last 7 days can't join the queue again until
-- 7 days after that session started. A "charge" is one session, i.e. one
-- default charging-time block, so the quota is one session per rolling 7 days.
--
-- Staff-created entries (INTERNAL/PRIORITY/DELIVERY/SERVICE) are exempt, same
-- as the other customer-only insert checks (is_staff()).
--
-- Deployment: run this file in the Supabase SQL editor. Depends on
-- queue_setup.sql, blocked_plates_setup.sql (normalize_plate) and
-- charging_timer_settings_setup.sql / manager_setup.sql (showroom_settings).

-- Off by default so applying this migration doesn't change behaviour until a
-- manager turns it on. Managers update it through showroom_settings' existing
-- manager-only UPDATE policy; anon can already read the row (public select).
alter table public.showroom_settings
  add column if not exists weekly_charge_limit_enabled boolean not null default false;

-- Returns when the plate may charge again, or NULL if it may join now (rule
-- disabled, or no qualifying session in the last 7 days). Only a timestamp is
-- exposed, never session or customer details, so anon can call it to show the
-- customer a clear message before submitting.
create or replace function public.plate_weekly_charge_available_at(p_plate text)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_last_started timestamptz;
begin
  select weekly_charge_limit_enabled into v_enabled
  from public.showroom_settings where id = 'main';

  if not coalesce(v_enabled, false) then
    return null;
  end if;

  select max(coalesce(cs.started_at, cs.created_at)) into v_last_started
  from public.charging_sessions cs
  join public.queue_entries q on q.id = cs.queue_entry_id
  where public.normalize_plate(q.plate_number) = public.normalize_plate(p_plate)
    and cs.status in ('active', 'completed')
    and coalesce(cs.started_at, cs.created_at) > now() - interval '7 days';

  if v_last_started is null then
    return null;
  end if;

  return v_last_started + interval '7 days';
end;
$$;

revoke all on function public.plate_weekly_charge_available_at(text) from public;
grant execute on function public.plate_weekly_charge_available_at(text)
  to anon, authenticated;

-- Server-side enforcement, so a direct API insert can't skip the client check.
create or replace function public.enforce_weekly_charge_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_staff() then
    return new;
  end if;

  if public.plate_weekly_charge_available_at(new.plate_number) is not null then
    raise exception 'WEEKLY_CHARGE_LIMIT_REACHED: This plate number has already used its charge for the past 7 days.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_weekly_charge_limit on public.queue_entries;
create trigger trg_enforce_weekly_charge_limit
before insert on public.queue_entries
for each row execute function public.enforce_weekly_charge_limit();

-- Trigger-only function: not meant to be callable via /rest/v1/rpc/.
revoke execute on function public.enforce_weekly_charge_limit() from public, anon, authenticated;
