-- Wires up the live queuing system in Supabase: charging bays, queue entries,
-- and charging sessions, shared across customer/SA/manager apps.
--
-- Deployment: run this file in the Supabase SQL editor (or via MCP apply_migration).

create table if not exists public.bays (
  id text primary key,
  name text not null,
  status text not null default 'available' check (status in ('available', 'occupied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.bays (id, name, status) values
  ('bay-1', 'Bay 1', 'available'),
  ('bay-2', 'Bay 2', 'available')
on conflict (id) do nothing;

create table if not exists public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_number text not null,
  plate_number text not null,
  battery_percentage integer not null,
  joined_at timestamptz not null default now(),
  status text not null default 'waiting'
    check (status in ('waiting', 'charging', 'completed', 'cancelled', 'skipped')),
  gps_validated boolean not null default false,
  gps_override_requested boolean not null default false,
  gps_override_approved boolean not null default false,
  bay_id text references public.bays(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_queue_entries_status_joined_at
  on public.queue_entries (status, joined_at);

create table if not exists public.charging_sessions (
  id uuid primary key default gen_random_uuid(),
  queue_entry_id uuid references public.queue_entries(id),
  bay_id text not null references public.bays(id),
  sa_name text not null,
  grace_minutes integer not null default 5,
  charging_minutes integer not null default 60,
  planned_duration_minutes integer not null default 65,
  actual_duration_minutes integer,
  started_at timestamptz,
  ended_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.bays enable row level security;
alter table public.queue_entries enable row level security;
alter table public.charging_sessions enable row level security;

-- Staff role gate: SA, manager, or admin accounts (customers are never signed in).
create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('sa', 'manager', 'admin')
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('sa', 'manager', 'admin')
  );
$$;

-- Bays: no customer PII, safe for everyone to read live; only staff can flip status.
drop policy if exists "public_select_bays" on public.bays;
create policy "public_select_bays"
on public.bays for select
using (true);

drop policy if exists "staff_update_bays" on public.bays;
create policy "staff_update_bays"
on public.bays for update
using (public.is_staff())
with check (public.is_staff());

-- Queue entries: customers (anonymous) can create their own entry. Row-level
-- access is open (both anon and staff can see rows exist), but the
-- phone_number column is hidden from the anon role at the column-privilege
-- level below — RLS alone can't hide a single column, and a view wouldn't be
-- safe here because Realtime's WAL-based broadcast can bypass a view's
-- column projection. queue_entries is therefore intentionally NOT added to
-- the realtime publication; clients poll it instead.
drop policy if exists "public_insert_queue_entries" on public.queue_entries;
create policy "public_insert_queue_entries"
on public.queue_entries for insert
with check (true);

drop policy if exists "staff_select_queue_entries" on public.queue_entries;
create policy "staff_select_queue_entries"
on public.queue_entries for select
using (public.is_staff());

drop policy if exists "anon_select_queue_entries" on public.queue_entries;
create policy "anon_select_queue_entries"
on public.queue_entries for select
to anon
using (true);

revoke select on public.queue_entries from anon;
grant select (
  id, name, plate_number, battery_percentage, joined_at, status,
  gps_validated, gps_override_requested, gps_override_approved,
  bay_id, created_at, updated_at
) on public.queue_entries to anon;

drop policy if exists "staff_update_queue_entries" on public.queue_entries;
create policy "staff_update_queue_entries"
on public.queue_entries for update
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "staff_delete_queue_entries" on public.queue_entries;
create policy "staff_delete_queue_entries"
on public.queue_entries for delete
using (public.is_staff());

-- Charging sessions: no customer PII stored here, safe to read publicly for
-- live bay/timer display; only staff can create or update sessions.
drop policy if exists "public_select_charging_sessions" on public.charging_sessions;
create policy "public_select_charging_sessions"
on public.charging_sessions for select
using (true);

drop policy if exists "staff_insert_charging_sessions" on public.charging_sessions;
create policy "staff_insert_charging_sessions"
on public.charging_sessions for insert
with check (public.is_staff());

drop policy if exists "staff_update_charging_sessions" on public.charging_sessions;
create policy "staff_update_charging_sessions"
on public.charging_sessions for update
using (public.is_staff())
with check (public.is_staff());

-- Customers never sign in, so this pre-existing policy silently blocked the
-- showroom-settings fetch the join screen depends on. Open it to anon too.
drop policy if exists "auth_read_showroom_settings" on public.showroom_settings;
drop policy if exists "public_read_showroom_settings" on public.showroom_settings;
create policy "public_read_showroom_settings"
on public.showroom_settings for select
using (true);

-- Realtime: bays and charging_sessions hold no customer PII, so live updates
-- are safe to broadcast to anyone. queue_entries is deliberately excluded —
-- see the comment above.
alter publication supabase_realtime add table public.bays;
alter publication supabase_realtime add table public.charging_sessions;
