-- Activity log: records every customer, SA, and manager action across the
-- app (queue joins, session start/end, cancellations, bay/setting changes,
-- account management) so managers can review it in Settings.
--
-- Deployment: run this file in the Supabase SQL editor. Depends on
-- public.is_manager() from manager_setup.sql already existing.

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_role text not null check (actor_role in ('customer', 'sa', 'manager', 'system')),
  actor_name text,
  action text not null,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_created_at
  on public.activity_logs (created_at desc);

alter table public.activity_logs enable row level security;

-- Anyone (including anonymous customers, whose join-queue action must be
-- logged) can write a log row. Only managers can read the log.
drop policy if exists "anyone_insert_activity_logs" on public.activity_logs;
create policy "anyone_insert_activity_logs"
on public.activity_logs for insert
with check (true);

drop policy if exists "manager_select_activity_logs" on public.activity_logs;
create policy "manager_select_activity_logs"
on public.activity_logs for select
using (public.is_manager());
