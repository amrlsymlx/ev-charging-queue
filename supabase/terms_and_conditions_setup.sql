-- Manager-editable Terms & Conditions text shown to customers on the Join
-- Queue screen. Stored on the existing showroom_settings singleton row, the
-- same way GPS and charging-timer settings already are.
--
-- Deployment: run this file in the Supabase SQL editor. Depends on
-- public.showroom_settings from manager_setup.sql already existing.

alter table public.showroom_settings
  add column if not exists terms_and_conditions text not null default
    'By joining the queue you agree to follow the showroom''s instructions, allow SA personnel to inspect and handle your vehicle, and accept that any service actions are performed at your own risk.';
