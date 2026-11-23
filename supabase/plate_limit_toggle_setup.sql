-- Makes the existing "one queue join per plate per day" rule manager-toggleable
-- and mutually exclusive with the weekly charge limit: at most one of the two
-- rules can be on at a time (both off is allowed).
--
-- Deployment: run in the Supabase SQL editor AFTER weekly_charge_limit_setup.sql
-- (it adds showroom_settings.weekly_charge_limit_enabled, which the constraint
-- below references). Safe to re-run.

-- On by default so existing behaviour (daily limit enforced) is unchanged.
alter table public.showroom_settings
  add column if not exists daily_plate_limit_enabled boolean not null default true;

-- If a manager already switched the weekly limit on before this migration,
-- the daily default of true would violate the constraint below; keep weekly
-- and turn daily off in that case.
update public.showroom_settings
set daily_plate_limit_enabled = false
where weekly_charge_limit_enabled and daily_plate_limit_enabled;

alter table public.showroom_settings
  drop constraint if exists showroom_settings_one_plate_limit;
alter table public.showroom_settings
  add constraint showroom_settings_one_plate_limit
  check (not (daily_plate_limit_enabled and weekly_charge_limit_enabled));

-- Client-called pre-check (same signature as plate_daily_limit_setup.sql): now
-- reports "not queued" whenever the daily rule is off, so the app needs no
-- extra logic.
create or replace function public.has_plate_queued_today(
  p_plate text,
  p_day_start timestamptz,
  p_day_end timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
      (select daily_plate_limit_enabled from public.showroom_settings where id = 'main'),
      true
    )
    and exists (
      select 1 from public.queue_entries
      where public.normalize_plate(plate_number) = public.normalize_plate(p_plate)
        and status <> 'cancelled'
        and joined_at >= p_day_start
        and joined_at < p_day_end
    );
$$;

grant execute on function public.has_plate_queued_today(text, timestamptz, timestamptz)
  to anon, authenticated;

-- Server-side backstop (same as server_side_enforce_gps_daily_limit_hours_setup.sql)
-- with the toggle check added.
create or replace function public.enforce_plate_daily_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_staff() then
    return new;
  end if;

  if not coalesce(
    (select daily_plate_limit_enabled from public.showroom_settings where id = 'main'),
    true
  ) then
    return new;
  end if;

  if exists (
    select 1 from public.queue_entries
    where public.normalize_plate(plate_number) = public.normalize_plate(new.plate_number)
      and status <> 'cancelled'
      and (joined_at at time zone 'Asia/Kuala_Lumpur')::date
        = (new.joined_at at time zone 'Asia/Kuala_Lumpur')::date
  ) then
    raise exception 'PLATE_ALREADY_QUEUED_TODAY: This plate number has already joined the charging queue today.';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_plate_daily_limit() from public, anon, authenticated;
