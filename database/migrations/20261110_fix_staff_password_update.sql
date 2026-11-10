-- Migration: Allow admins to update Supabase Auth passwords for staff accounts.
-- Root cause: api.js PUT handlers stripped password before Supabase writes and had
--   no way to update auth.users without a service role key.
-- Solution: SECURITY DEFINER function that runs as postgres superuser (which has
--   access to auth schema). JWT check inside ensures only admins can call it.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION update_staff_password(p_contact_number TEXT, p_password TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_password, gen_salt('bf'))
  WHERE email = p_contact_number || '@survaive.ph';
END;
$$;
