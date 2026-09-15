-- Lets a manager mark which side of the bay the charger connector sits on
-- (left or right), so SAs can back the correct side of the vehicle in.
--
-- Deployment: run this file in the Supabase SQL editor. Depends on
-- public.bays (queue_setup.sql) already existing.

alter table public.bays
  add column if not exists orientation text not null default 'left';

alter table public.bays
  drop constraint if exists bays_orientation_check;

alter table public.bays
  add constraint bays_orientation_check check (orientation in ('left', 'right'));

-- Orientation is a layout setting, same trust level as the bay name, so it
-- rides the existing "staff_update_bays" update policy from queue_setup.sql.
