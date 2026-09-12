-- Limits each plate number to one charging queue join per day. "Today" is
-- passed in from the client as an explicit [day_start, day_end) range
-- (the customer device's local midnight-to-midnight) rather than computed
-- from the database's own timezone, so the boundary matches what the
-- customer actually sees as "today" on their phone.
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
  select exists (
    select 1 from public.queue_entries
    where public.normalize_plate(plate_number) = public.normalize_plate(p_plate)
      and status <> 'cancelled'
      and joined_at >= p_day_start
      and joined_at < p_day_end
  );
$$;

grant execute on function public.has_plate_queued_today(text, timestamptz, timestamptz)
  to anon, authenticated;
