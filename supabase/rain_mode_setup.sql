-- Adds heavy rain mode toggle used by SA dashboard, public board, and join page.
-- When enabled, existing charging sessions continue as normal but queue wait
-- times become indefinite and the board shows a rain/thunder indicator.
alter table if exists public.showroom_settings
add column if not exists rain_mode boolean not null default false;

update public.showroom_settings
set rain_mode = false
where id = 'main' and rain_mode is null;

-- The table's own UPDATE policy is manager/admin-only (grace_minutes,
-- charging_minutes, gps settings, terms are manager-controlled), but rain
-- mode should be flippable by SA staff on the floor too. A SECURITY DEFINER
-- RPC scoped to just this column lets SA toggle it without loosening RLS on
-- the rest of showroom_settings.
create or replace function public.set_rain_mode(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('sa', 'manager', 'admin')
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('sa', 'manager', 'admin')
  ) then
    raise exception 'Not authorized to change rain mode.';
  end if;

  update public.showroom_settings
  set rain_mode = p_enabled
  where id = 'main';
end;
$$;

grant execute on function public.set_rain_mode(boolean) to authenticated;

-- showroom_settings wasn't part of the realtime publication (unlike bays /
-- charging_sessions / operating_hours), so postgres_changes subscribers
-- (board, SA panel, join page) never received rain_mode updates and only
-- saw the new value on their next full reload. It already has a public-read
-- RLS policy, so broadcasting changes doesn't expose anything new.
alter publication supabase_realtime add table public.showroom_settings;
