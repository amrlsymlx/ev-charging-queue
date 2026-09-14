-- Encrypts the manager-visible SA/manager password column at rest.
-- Applied directly to the project as migration `encrypt_sa_user_passwords`;
-- kept here so the repo's supabase/ scripts stay a complete record of live
-- schema changes. sa_users.password_plaintext (added in manager_setup.sql)
-- let a leaked service-role key, DB backup, or RLS misconfig hand over real
-- SA login credentials directly. The "View Password" feature in the admin
-- dashboard is preserved, but the password is now only ever readable
-- through get_sa_password(), which decrypts it on the fly using a key held
-- in Supabase Vault (pgsodium-backed) that clients never see.

-- 1. Generate and store a symmetric key in Vault, if not already present.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'sa_password_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'sa_password_key',
      'Symmetric key for encrypting public.sa_users password data'
    );
  end if;
end $$;

-- 2. Encrypted column replaces the plaintext one.
alter table public.sa_users add column if not exists password_encrypted bytea;

-- One-time backfill for installs upgrading from the plaintext column.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sa_users'
      and column_name = 'password_plaintext'
  ) then
    update public.sa_users su
    set password_encrypted = extensions.pgp_sym_encrypt(
      su.password_plaintext,
      (select decrypted_secret from vault.decrypted_secrets where name = 'sa_password_key')
    )
    where su.password_plaintext is not null
      and su.password_encrypted is null;
  end if;
end $$;

-- 3. RPCs: only these can read/write SA passwords from now on.
create or replace function public.set_sa_password(p_email text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions, vault
as $$
declare
  v_key text;
begin
  if not (public.is_manager() or auth.role() = 'service_role') then
    raise exception 'Not authorized';
  end if;

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'sa_password_key';

  update public.sa_users
  set password_encrypted = case
    when p_password is null then null
    else pgp_sym_encrypt(p_password, v_key)
  end
  where lower(email) = lower(p_email);
end;
$$;

revoke all on function public.set_sa_password(text, text) from public;
grant execute on function public.set_sa_password(text, text) to authenticated, service_role;

-- Manager or the SA themself (mirrors the manager_select_sa_users RLS policy).
create or replace function public.get_sa_password(p_email text)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions, vault
as $$
declare
  v_key text;
  v_encrypted bytea;
begin
  if not (
    public.is_manager()
    or lower(p_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  ) then
    raise exception 'Not authorized';
  end if;

  select password_encrypted into v_encrypted
  from public.sa_users
  where lower(email) = lower(p_email);

  if v_encrypted is null then
    return null;
  end if;

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'sa_password_key';

  return pgp_sym_decrypt(v_encrypted, v_key);
end;
$$;

revoke all on function public.get_sa_password(text) from public;
grant execute on function public.get_sa_password(text) to authenticated;

-- 4. Drop the plaintext column now that everything reads/writes through the
-- RPCs above (create-sa-account, reset-sa-password edge functions, and the
-- admin dashboard's "View Password" action were all updated accordingly).
alter table public.sa_users drop column if exists password_plaintext;
