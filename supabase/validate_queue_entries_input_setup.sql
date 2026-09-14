-- Server-side input validation for queue_entries.
-- Applied directly to the project as migration `validate_queue_entries_input`;
-- kept here so the repo's supabase/ scripts stay a complete record of live
-- schema changes.
--
-- The customer join screen (app/customer/join.tsx) already validates these
-- fields client-side, but that's bypassable by any direct call to the public
-- REST API using the anon key. These CHECK constraints mirror the client-side
-- rules (name >= 1 char, phone 7-15 digits, plate 1-20 chars, battery 0-100)
-- so the validation can't be skipped by going around the app's UI.

alter table public.queue_entries
  add constraint queue_entries_battery_percentage_range
  check (battery_percentage between 0 and 100);

alter table public.queue_entries
  add constraint queue_entries_name_length
  check (length(trim(name)) between 1 and 100);

-- '-' is the placeholder staff use for internal/priority/delivery/service
-- entries (see addStaffQueueEntry in context/QueueContext.tsx), which skip
-- the customer phone-number field entirely.
alter table public.queue_entries
  add constraint queue_entries_phone_number_format
  check (phone_number = '-' or phone_number ~ '^\+?[0-9]{7,15}$');

alter table public.queue_entries
  add constraint queue_entries_plate_number_length
  check (length(trim(plate_number)) between 1 and 20);
