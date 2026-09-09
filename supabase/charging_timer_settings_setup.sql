-- Manager-configurable charging timer: grace period (initializing) and
-- charging duration, in minutes. Stored on the existing showroom_settings
-- singleton row so the customer/SA apps can read it the same way they
-- already read GPS settings.
--
-- Deployment: run this file in the Supabase SQL editor. Depends on
-- public.showroom_settings from manager_setup.sql already existing.

alter table public.showroom_settings
  add column if not exists grace_minutes integer not null default 5;

alter table public.showroom_settings
  add column if not exists charging_minutes integer not null default 60;
