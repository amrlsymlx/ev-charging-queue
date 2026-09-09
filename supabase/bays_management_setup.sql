-- Manager-managed bay list: add bays, name them, and enable/disable them
-- (maintenance, faulty, priority, or a custom reason). A disabled bay stays
-- visible everywhere it already appeared — it's just labeled disabled with
-- its reason and can't be started into.
--
-- Deployment: run this file in the Supabase SQL editor. Depends on
-- public.bays (queue_setup.sql) and public.is_manager() (manager_setup.sql)
-- already existing.

alter table public.bays
  add column if not exists enabled boolean not null default true;

alter table public.bays
  add column if not exists disabled_reason text;

-- Only managers add or remove bays; SA/manager staff still flip `status`
-- between available/occupied as part of starting/ending a charging session
-- (see the existing "staff_update_bays" policy from queue_setup.sql).
drop policy if exists "manager_insert_bays" on public.bays;
create policy "manager_insert_bays"
on public.bays for insert
with check (public.is_manager());

drop policy if exists "manager_delete_bays" on public.bays;
create policy "manager_delete_bays"
on public.bays for delete
using (public.is_manager());
