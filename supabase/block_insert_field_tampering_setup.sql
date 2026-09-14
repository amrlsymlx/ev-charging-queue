-- Closes an INSERT field-tampering gap on queue_entries and activity_logs.
-- Applied directly to the project as migration `block_insert_field_tampering`;
-- kept here so the repo's supabase/ scripts stay a complete record of live
-- schema changes.
--
-- Both tables previously had `with check (true)` insert policies, which only
-- gates whether a row can be inserted at all — not which values go into
-- which columns. Since anon has full (unrestricted) column-level INSERT
-- grants by Postgres default, any direct call to the public REST API using
-- the anon key (bypassing the app's own UI entirely) could set privileged
-- fields on an otherwise-legitimate-looking insert:
--   - queue_entries: jump the queue via a backdated joined_at, self-approve
--     a GPS override, self-assign a bay_id, or grant unlimited charging
--     time via override_charging_minutes.
--   - activity_logs: forge an audit trail entry claiming actor_role
--     'manager'/'sa' while calling anonymously, since only managers can
--     read the log (RLS), nothing previously stopped anyone writing to it.

drop policy if exists "public_insert_queue_entries" on public.queue_entries;
create policy "public_insert_queue_entries"
on public.queue_entries for insert
with check (
  public.is_staff()
  or (
    status = 'waiting'
    and gps_override_approved = false
    and bay_id is null
    and override_charging_minutes is null
    and joined_at between now() - interval '5 minutes' and now() + interval '2 minutes'
  )
);

-- Ties actor_role to the caller's real session role instead of letting the
-- client self-report it. 'system' is intentionally left unreachable from
-- anon/authenticated — the service_role used by edge functions bypasses RLS
-- entirely, so it isn't affected by this policy either way.
drop policy if exists "anyone_insert_activity_logs" on public.activity_logs;
create policy "anyone_insert_activity_logs"
on public.activity_logs for insert
with check (
  case
    when public.is_manager() then actor_role = 'manager'
    when public.is_staff() then actor_role = 'sa'
    else actor_role = 'customer'
  end
);
