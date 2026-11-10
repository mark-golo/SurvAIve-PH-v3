-- Migration: Grant admin role full write access to the admins table.
-- Root cause: "superadmin manage admins" RLS policy required role='superadmin',
--   which no longer exists — admin is now the top elevated role.
--   All INSERT/UPDATE/DELETE on admins failed with RLS policy violation.

-- 1. Drop the superadmin-only write policy (superadmin role is retired).
DROP POLICY IF EXISTS "superadmin manage admins" ON admins;
DROP POLICY IF EXISTS "admin manage admins" ON admins;

-- 2. Allow admin (and superadmin as a no-op alias) to manage all admin rows.
--    WITH CHECK mirrors USING so both reads and writes are gated the same way.
CREATE POLICY "admin manage admins"
  ON admins FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin')
  );

-- 3. "admin read self" (SELECT-only) is now redundant — FOR ALL above covers SELECT.
DROP POLICY IF EXISTS "admin read self" ON admins;
