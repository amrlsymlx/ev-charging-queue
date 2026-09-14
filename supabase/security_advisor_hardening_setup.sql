-- Security hardening from a Supabase security advisor scan (2026-09-14).
-- Applied directly to the project as migration
-- `harden_function_search_path_and_revoke_internal_rpc`; kept here so the
-- repo's supabase/ scripts stay a complete record of live schema changes.

-- function_search_path_mutable: these functions read auth.jwt() / query
-- public tables without a pinned search_path, so a role that can create
-- objects earlier in the caller's search_path could shadow the functions
-- they call. Pin it explicitly.
alter function public.is_staff() set search_path = public, auth;
alter function public.is_manager() set search_path = public, auth;
alter function public.normalize_plate(text) set search_path = public;

-- anon/authenticated_security_definer_function_executable: these two are
-- trigger / event-trigger functions only ever meant to be invoked by
-- Postgres itself (a BEFORE INSERT trigger and a DDL event trigger,
-- respectively), never called directly by clients. PostgREST exposes every
-- function in the public schema over /rest/v1/rpc/ by default, so anon and
-- authenticated had a stray EXECUTE grant on both. Revoking it doesn't
-- affect trigger firing, which doesn't require the firing role to hold
-- EXECUTE on the trigger function.
revoke execute on function public.enforce_plate_not_blocked() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;

-- Not changed, and why: delete_sa_account, set_rain_mode, is_plate_blocked,
-- and has_plate_queued_today are also flagged as SECURITY DEFINER functions
-- callable by anon/authenticated, but each is intentionally public —
-- delete_sa_account and set_rain_mode do their own role check internally
-- (raise exception if not manager/staff), and is_plate_blocked /
-- has_plate_queued_today only ever return a boolean and back the anonymous
-- queue-join flow's duplicate/blocked-plate checks. Revoking EXECUTE on
-- those would break the app.

-- auth_leaked_password_protection: not a SQL/RLS setting — enable manually
-- via Supabase Dashboard > Authentication > Policies > Password Security,
-- or the Management API. No migration can flip this from here.
