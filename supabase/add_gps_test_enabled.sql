-- Adds developer-mode GPS test toggle field used by admin dashboard and join page.
alter table if exists public.showroom_settings
add column if not exists gps_test_enabled boolean not null default true;

-- Ensure existing row has a value.
update public.showroom_settings
set gps_test_enabled = true
where id = 'main' and gps_test_enabled is null;
