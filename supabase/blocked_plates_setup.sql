-- Blocked plate numbers: managers maintain a list of plate numbers that are
-- refused entry to the queue (e.g. T&C violations).
--
-- Deployment: run this file in the Supabase SQL editor. Depends on
-- public.is_manager() from manager_setup.sql already being installed.

create table if not exists public.blocked_plates (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null unique,
  reason text,
  blocked_by text,
  created_at timestamptz not null default now()
);

alter table public.blocked_plates enable row level security;

drop policy if exists "manager_select_blocked_plates" on public.blocked_plates;
create policy "manager_select_blocked_plates"
on public.blocked_plates for select
using (public.is_manager());

drop policy if exists "manager_insert_blocked_plates" on public.blocked_plates;
create policy "manager_insert_blocked_plates"
on public.blocked_plates for insert
with check (public.is_manager());

drop policy if exists "manager_delete_blocked_plates" on public.blocked_plates;
create policy "manager_delete_blocked_plates"
on public.blocked_plates for delete
using (public.is_manager());

-- Normalizes a plate to uppercase alphanumeric-only, so "abc 1234",
-- "ABC-1234" and "ABC1234" all match the same blocklist entry.
create or replace function public.normalize_plate(plate text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(plate, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Lets the customer (anon) app check a single plate without granting SELECT
-- access to the full blocklist table.
create or replace function public.is_plate_blocked(plate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocked_plates
    where public.normalize_plate(plate_number) = public.normalize_plate(plate)
  );
$$;

revoke all on function public.is_plate_blocked(text) from public;
grant execute on function public.is_plate_blocked(text) to anon, authenticated;

-- Server-side enforcement: rejects the insert outright even if a client
-- skips or bypasses the app's own pre-submit check.
create or replace function public.enforce_plate_not_blocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.blocked_plates
    where public.normalize_plate(plate_number) = public.normalize_plate(new.plate_number)
  ) then
    raise exception 'PLATE_BLOCKED: This plate number is blocked from using our charger due violation of our T&C';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_plate_not_blocked on public.queue_entries;
create trigger trg_enforce_plate_not_blocked
before insert on public.queue_entries
for each row execute function public.enforce_plate_not_blocked();
