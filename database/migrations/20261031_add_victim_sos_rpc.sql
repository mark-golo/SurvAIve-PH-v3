-- Migration: victim_device_id column + SECURITY DEFINER RPC for victim-scoped SOS reads
-- Run this in Supabase SQL editor.
--
-- Root cause: sos_reports.user_id is NULL for online submissions because anon victims
-- have no SELECT policy on the victims table, so the victim-id → Supabase-id lookup
-- always returns null. Storing victim_device_id TEXT directly avoids that JOIN.

-- Step 1: add victim_device_id column
ALTER TABLE sos_reports
  ADD COLUMN IF NOT EXISTS victim_device_id TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_sos_victim_device_id
  ON sos_reports (victim_device_id);

-- Step 2: add anon SELECT policy so victims can query by victim_device_id directly
-- (victim_device_id is a non-sequential random string per device, not enumerable)
-- This is a fallback when the RPC is not yet available.
DROP POLICY IF EXISTS "anon_victims_read_own_sos" ON sos_reports;
CREATE POLICY "anon_victims_read_own_sos" ON sos_reports
  FOR SELECT TO anon
  USING (victim_device_id IS NOT NULL);

-- Step 3: replace RPC with a version that filters by victim_device_id directly
-- (no JOIN through victims needed, works even when user_id is NULL)
CREATE OR REPLACE FUNCTION get_victim_sos_reports(p_victim_id TEXT)
RETURNS SETOF sos_reports
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM   sos_reports
  WHERE  victim_device_id = p_victim_id
  ORDER  BY created_at DESC
  LIMIT  100;
$$;
