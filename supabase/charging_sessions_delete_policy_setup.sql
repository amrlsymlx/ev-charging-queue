-- Manager "Reset" on Customer History hard-deletes queue_entries and their
-- charging_sessions. queue_entries already has a staff delete policy
-- (queue_setup.sql); charging_sessions never got one, so the delete would
-- silently affect 0 rows under RLS.
--
-- Deployment: run this file in the Supabase SQL editor (or via MCP apply_migration).

drop policy if exists "staff_delete_charging_sessions" on public.charging_sessions;
create policy "staff_delete_charging_sessions"
on public.charging_sessions for delete
using (public.is_staff());
