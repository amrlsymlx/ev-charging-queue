-- Manager feature setup for SA account access list and showroom GPS settings
--
-- Deployment:
-- 1. Run this file in the Supabase SQL editor.
-- 2. Deploy supabase/functions/create-sa-account (uses service role key,
--    kept server-side only) so manager-created SA accounts skip email
--    verification entirely (email_confirm: true).
-- 3. Set the SUPABASE_SERVICE_ROLE_KEY secret for that function via
--    `supabase secrets set` — never embed it in the client app.

create table if not exists public.sa_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  role text not null default 'sa',
  password_plaintext text,
  created_at timestamptz not null default now()
);

-- Existing installs: add the column used by the manager's "View Password" action.
alter table public.sa_users
  add column if not exists password_plaintext text;


create table if not exists public.showroom_settings (
  id text primary key,
  showroom_name text not null,
  latitude double precision not null,
  longitude double precision not null,
  gps_radius_m integer not null default 50,
  updated_at timestamptz not null default now()
);

insert into public.showroom_settings (id, showroom_name, latitude, longitude, gps_radius_m)
values ('main', 'Main Showroom', 3.1390, 101.6869, 50)
on conflict (id) do nothing;

alter table public.sa_users enable row level security;
alter table public.showroom_settings enable row level security;

-- Manager role gate from Supabase auth metadata.
create or replace function public.is_manager()
returns boolean
language sql
stable
as $$
  select (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('manager', 'admin')
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('manager', 'admin')
  );
$$;

-- SA list policies
drop policy if exists "manager_select_sa_users" on public.sa_users;
create policy "manager_select_sa_users"
on public.sa_users for select
using (
  public.is_manager()
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "manager_insert_sa_users" on public.sa_users;
create policy "manager_insert_sa_users"
on public.sa_users for insert
with check (public.is_manager());

drop policy if exists "manager_update_sa_users" on public.sa_users;
create policy "manager_update_sa_users"
on public.sa_users for update
using (public.is_manager())
with check (public.is_manager());

drop policy if exists "manager_delete_sa_users" on public.sa_users;
create policy "manager_delete_sa_users"
on public.sa_users for delete
using (public.is_manager());

-- Showroom settings policies
drop policy if exists "auth_read_showroom_settings" on public.showroom_settings;
create policy "auth_read_showroom_settings"
on public.showroom_settings for select
using (auth.role() = 'authenticated');

drop policy if exists "manager_write_showroom_settings" on public.showroom_settings;
create policy "manager_write_showroom_settings"
on public.showroom_settings for insert
with check (public.is_manager());

drop policy if exists "manager_update_showroom_settings" on public.showroom_settings;
create policy "manager_update_showroom_settings"
on public.showroom_settings for update
using (public.is_manager())
with check (public.is_manager());

-- Optional hard-delete helper for manager SA deletion.
create or replace function public.delete_sa_account(sa_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_manager() then
    raise exception 'Not authorized';
  end if;

  delete from auth.users
  where lower(email) = lower(sa_email);

  delete from public.sa_users
  where lower(email) = lower(sa_email);
end;
$$;

revoke all on function public.delete_sa_account(text) from public;
grant execute on function public.delete_sa_account(text) to authenticated;
