-- Lets a manager "zero" the Sessions / Charger Utilization counters on the
-- Stats tab without deleting the underlying charging_sessions rows (which
-- Customer History still needs for its full audit trail).
--
-- Deployment: run this file in the Supabase SQL editor (or via MCP apply_migration).

alter table public.showroom_settings
  add column if not exists stats_reset_at timestamptz;
