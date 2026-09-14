-- Closes 3 checks that were previously enforced only in client JS and
-- bypassable via a direct call to the public REST API with the anon key.
-- Applied directly to the project as migration
-- `server_side_enforce_gps_daily_limit_hours`; kept here so the repo's
-- supabase/ scripts stay a complete record of live schema changes.
--
--   1. GPS proximity — gps_validated was just a plain boolean in the insert
--      payload; a direct API call could set it to true regardless of
--      actual location.
--   2. One queue join per plate per operating day — only checked via a
--      client-called RPC (has_plate_queued_today) before insert; nothing
--      stopped the insert itself.
--   3. Registration cutoff / operating hours — only enforced by disabling
--      the Join button client-side.
--
-- All three are BEFORE INSERT triggers on queue_entries, matching the
-- existing trg_enforce_plate_not_blocked pattern, and are skipped for staff
-- (is_staff()) inserts — SA/manager-created entries (internal, priority,
-- delivery, service) are intentionally exempt from the customer
-- registration flow's rules.
--
-- Caveat on #1: this still only proves the submitted coordinates are within
-- range of the showroom, not that the device is honest about its GPS fix.
-- A public anon-key API can't verify device honesty without device
-- attestation, which this app doesn't have. This closes the trivial
-- "just send gps_validated: true" bypass — the actual gap that existed —
-- it doesn't (and can't) fully prevent GPS spoofing.

create or replace function public.haversine_meters(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select 6371000 * 2 * asin(sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2
  ));
$$;

-- Customers submit their device's coordinates here; the app never reads
-- them back (not in the anon SELECT grant) — they only feed the trigger
-- below.
alter table public.queue_entries
  add column if not exists submitted_latitude double precision,
  add column if not exists submitted_longitude double precision;

-- 1. GPS proximity: recompute gps_validated/gps_override_requested/
-- gps_override_approved server-side from the submitted coordinates,
-- overriding whatever the client sent for those three columns.
create or replace function public.enforce_gps_validation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings record;
  v_distance double precision;
begin
  if public.is_staff() then
    return new;
  end if;

  select latitude, longitude, gps_radius_m into v_settings
  from public.showroom_settings where id = 'main';

  if v_settings.latitude is null or v_settings.longitude is null
     or new.submitted_latitude is null or new.submitted_longitude is null then
    new.gps_validated := false;
  else
    v_distance := public.haversine_meters(
      new.submitted_latitude, new.submitted_longitude,
      v_settings.latitude, v_settings.longitude
    );
    new.gps_validated := v_distance <= v_settings.gps_radius_m;
  end if;

  new.gps_override_requested := not new.gps_validated;
  new.gps_override_approved := false;

  return new;
end;
$$;

drop trigger if exists trg_enforce_gps_validation on public.queue_entries;
create trigger trg_enforce_gps_validation
before insert on public.queue_entries
for each row execute function public.enforce_gps_validation();

-- 2. One queue join per plate per calendar day (Asia/Kuala_Lumpur) — a
-- simpler, still-effective approximation of the client's precise
-- operating-day-boundary logic (which accounts for overnight hours);
-- good enough as a backstop against the actual abuse case (rapid
-- re-joining), even if it doesn't perfectly match every edge case the
-- client-side has_plate_queued_today check does.
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

drop trigger if exists trg_enforce_plate_daily_limit on public.queue_entries;
create trigger trg_enforce_plate_daily_limit
before insert on public.queue_entries
for each row execute function public.enforce_plate_daily_limit();

-- 3. Registration cutoff / operating hours (Asia/Kuala_Lumpur).
create or replace function public.enforce_registration_hours()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local timestamp;
  v_today date;
  v_is_holiday boolean;
  v_dow int;
  v_schedule record;
  v_now_minutes int;
  v_open_minutes int;
  v_last_reg_minutes int;
begin
  if public.is_staff() then
    return new;
  end if;

  v_local := now() at time zone 'Asia/Kuala_Lumpur';
  v_today := v_local::date;

  select exists(select 1 from public.public_holidays where holiday_date = v_today) into v_is_holiday;
  v_dow := case when v_is_holiday then 0 else extract(dow from v_today)::int end;

  select * into v_schedule from public.operating_hours where day_of_week = v_dow;

  if v_schedule is null or v_schedule.is_closed then
    raise exception 'REGISTRATION_CLOSED: Queue registration is closed today.';
  end if;

  v_now_minutes := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;
  v_open_minutes := extract(hour from v_schedule.open_time)::int * 60 + extract(minute from v_schedule.open_time)::int;
  v_last_reg_minutes := extract(hour from v_schedule.last_registration_time)::int * 60 + extract(minute from v_schedule.last_registration_time)::int;

  if v_now_minutes < v_open_minutes or v_now_minutes >= v_last_reg_minutes then
    raise exception 'REGISTRATION_CLOSED: Queue registration is currently closed.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_registration_hours on public.queue_entries;
create trigger trg_enforce_registration_hours
before insert on public.queue_entries
for each row execute function public.enforce_registration_hours();

-- Hardening pass (migration `harden_new_gps_hours_triggers`): pin
-- haversine_meters' search_path, and revoke the stray anon/authenticated
-- EXECUTE grant PostgREST adds by default to every public-schema function —
-- these three are trigger-only functions, never meant to be called directly
-- via /rest/v1/rpc/, matching the existing enforce_plate_not_blocked revoke.
alter function public.haversine_meters(double precision, double precision, double precision, double precision)
  set search_path = public;

revoke execute on function public.enforce_gps_validation() from anon, authenticated;
revoke execute on function public.enforce_plate_daily_limit() from anon, authenticated;
revoke execute on function public.enforce_registration_hours() from anon, authenticated;
