-- Stops customers from seeing each other's real name/phone number.
-- Applied directly to the project as migration
-- `hide_customer_name_from_anon_add_verified_lookup`; kept here so the
-- repo's supabase/ scripts stay a complete record of live schema changes.
--
-- The anon column grant on queue_entries included `name` (phone_number was
-- already excluded). Combined with the old "Find My Queue" flow, which
-- resolved ANY plate number — visible on the car itself, not a secret — to
-- that entry's id and displayed it by name on the status page, any stranger
-- who saw or guessed a plate could view that customer's real name.

-- 1. Remove `name` from what anon can read via the general table/list.
revoke select on public.queue_entries from anon;
grant select (
  id, plate_number, battery_percentage, joined_at, status,
  gps_validated, gps_override_requested, gps_override_approved,
  bay_id, created_at, updated_at, agreed_to_terms
) on public.queue_entries to anon;

-- 2. The only way to get a full row back (name + phone) as anon is now this
-- RPC, which requires proving you know BOTH the plate AND the phone number
-- on file for it — a stranger who only saw the car's plate can't satisfy
-- this, but the actual customer (who gave their own phone number when
-- joining) can look themselves up from a different device/after a reinstall.
-- app/customer/track.tsx ("Find My Queue") now collects both fields and
-- calls this via context/QueueContext.tsx's findMyEntryByPlateAndPhone.
create or replace function public.find_my_queue_entry(p_plate text, p_phone text)
returns setof public.queue_entries
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.queue_entries
  where public.normalize_plate(plate_number) = public.normalize_plate(p_plate)
    and regexp_replace(coalesce(phone_number, ''), '[^0-9]', '', 'g')
      = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
    and phone_number <> '-'
  order by created_at desc
  limit 1;
$$;

revoke all on function public.find_my_queue_entry(text, text) from public;
grant execute on function public.find_my_queue_entry(text, text) to anon, authenticated;
