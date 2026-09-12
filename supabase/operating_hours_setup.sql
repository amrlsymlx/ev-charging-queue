-- Manager-configurable weekly operating hours and public holidays.
--
-- day_of_week follows JS Date.getDay() (0 = Sunday ... 6 = Saturday) so the
-- client can look up "today's" row with zero translation. Public holidays
-- are looked up by exact date and, when matched, force the Sunday (0) row
-- to apply for that day regardless of the actual weekday.
--
-- Deployment: run this file in the Supabase SQL editor. Depends on
-- public.is_manager() from manager_setup.sql already existing.

create table if not exists public.operating_hours (
  day_of_week smallint primary key check (day_of_week between 0 and 6),
  is_closed boolean not null default false,
  open_time time not null default '09:00',
  close_time time not null default '18:00',
  last_registration_time time not null default '17:30',
  updated_at timestamptz not null default now()
);

insert into public.operating_hours (day_of_week, open_time, close_time, last_registration_time)
values
  (0, '09:00', '18:00', '17:30'),
  (1, '09:00', '18:00', '17:30'),
  (2, '09:00', '18:00', '17:30'),
  (3, '09:00', '18:00', '17:30'),
  (4, '09:00', '18:00', '17:30'),
  (5, '09:00', '18:00', '17:30'),
  (6, '09:00', '18:00', '17:30')
on conflict (day_of_week) do nothing;

create table if not exists public.public_holidays (
  holiday_date date primary key,
  label text,
  created_at timestamptz not null default now()
);

alter table public.operating_hours enable row level security;
alter table public.public_holidays enable row level security;

-- Everyone (including anonymous customers) needs to read the schedule to
-- know whether the queue is open right now, same as showroom_settings.
drop policy if exists "public_read_operating_hours" on public.operating_hours;
create policy "public_read_operating_hours"
on public.operating_hours for select
using (true);

-- The manager UI saves the week via upsert(), which Postgres executes as
-- INSERT ... ON CONFLICT DO UPDATE — RLS checks the INSERT policy for that
-- statement even though every row already exists, so both policies are
-- needed even though managers never actually insert a new day.
drop policy if exists "manager_insert_operating_hours" on public.operating_hours;
create policy "manager_insert_operating_hours"
on public.operating_hours for insert
with check (public.is_manager());

drop policy if exists "manager_update_operating_hours" on public.operating_hours;
create policy "manager_update_operating_hours"
on public.operating_hours for update
using (public.is_manager())
with check (public.is_manager());

drop policy if exists "public_read_public_holidays" on public.public_holidays;
create policy "public_read_public_holidays"
on public.public_holidays for select
using (true);

drop policy if exists "manager_insert_public_holidays" on public.public_holidays;
create policy "manager_insert_public_holidays"
on public.public_holidays for insert
with check (public.is_manager());

drop policy if exists "manager_delete_public_holidays" on public.public_holidays;
create policy "manager_delete_public_holidays"
on public.public_holidays for delete
using (public.is_manager());

-- Live Queue Board subscribes to these so a manager's edit shows up
-- immediately without a page refresh. Neither table carries customer PII.
alter publication supabase_realtime add table public.operating_hours;
alter publication supabase_realtime add table public.public_holidays;
