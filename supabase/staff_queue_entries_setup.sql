-- Lets SA staff create non-customer queue entries (internal, priority,
-- delivery, service vehicles) with an optional per-entry charging-time
-- override, instead of the customer's normal plate-number join flow.
--
-- Deployment: run this file in the Supabase SQL editor. Depends on
-- public.queue_entries (queue_setup.sql) already existing. No RLS changes
-- needed: staff already has full insert access, and the anon role's
-- column-privilege whitelist (see queue_setup.sql) already excludes any
-- column not explicitly granted, so this new column stays staff-only.

alter table public.queue_entries
  add column if not exists override_charging_minutes integer;
