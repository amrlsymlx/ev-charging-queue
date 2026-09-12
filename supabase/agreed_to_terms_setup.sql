-- Adds a persisted "agreed to Terms & Conditions" flag to queue_entries so
-- the manager stats history table can show it per customer.
--
-- Deployment: run this file in the Supabase SQL editor (or via MCP apply_migration).

alter table public.queue_entries
  add column if not exists agreed_to_terms boolean not null default false;

-- Re-issue the anon column-select grant to include the new column (anon has
-- no default select privilege at all — see queue_setup.sql).
grant select (
  id, name, plate_number, battery_percentage, joined_at, status,
  gps_validated, gps_override_requested, gps_override_approved,
  bay_id, created_at, updated_at, agreed_to_terms
) on public.queue_entries to anon;

