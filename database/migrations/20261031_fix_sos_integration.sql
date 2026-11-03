-- Migration: Fix SOS integration — anon SELECT policy + update_sos_by_id re-deploy
-- Run this in Supabase SQL editor.
--
-- Fixes:
--   1. Admin (PHP-only auth → anon in Supabase) can SELECT all sos_reports.
--      The old "anon_victims_read_own_sos" policy only allowed reads where
--      victim_device_id IS NOT NULL, which blocked guest SOS and broke the
--      admin's api.get('/sos') Supabase query (sbThrow on error, before MySQL fallback).
--   2. Re-deploys update_sos_by_id RPC so responder status updates reach Supabase
--      (api.put('/sos/:id') calls this RPC; if missing, the catch silently swallows
--      the error and neither Supabase nor MySQL gets the update).

-- Step 1: replace restrictive anon SELECT with a permissive one.
-- Both victims and staff authenticate via PHP JWT → Supabase treats both as anon.
-- Application-level filtering handles what each role can see.
DROP POLICY IF EXISTS "anon_victims_read_own_sos" ON sos_reports;
DROP POLICY IF EXISTS "anon_full_read_sos" ON sos_reports;
DROP POLICY IF EXISTS "anon_read_sos" ON sos_reports;
CREATE POLICY "anon_read_sos" ON sos_reports
  FOR SELECT TO anon USING (true);

-- Step 2: re-deploy update_sos_by_id (idempotent).
-- SECURITY DEFINER bypasses RLS so anon staff can update SOS records.
DROP FUNCTION IF EXISTS update_sos_by_id(bigint,text,text,timestamp with time zone,text,bigint,boolean,text);
DROP FUNCTION IF EXISTS update_sos_by_id(bigint,text,text,timestamp with time zone,text,bigint,boolean,text,text);
CREATE OR REPLACE FUNCTION update_sos_by_id(
  p_id                    BIGINT,
  p_rescue_status         TEXT        DEFAULT NULL,
  p_confirmed_by_name     TEXT        DEFAULT NULL,
  p_confirmed_at          TIMESTAMPTZ DEFAULT NULL,
  p_notes                 TEXT        DEFAULT NULL,
  p_assigned_responder_id BIGINT      DEFAULT NULL,
  p_dismissed             BOOLEAN     DEFAULT NULL,
  p_status                TEXT        DEFAULT NULL,
  p_confirmed_by_role     TEXT        DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_rescue TEXT;
BEGIN
  SELECT rescue_status INTO old_rescue FROM sos_reports WHERE id = p_id;

  UPDATE sos_reports SET
    rescue_status         = COALESCE(p_rescue_status,         rescue_status),
    confirmed_by_name     = COALESCE(p_confirmed_by_name,     confirmed_by_name),
    confirmed_at          = COALESCE(p_confirmed_at,          confirmed_at),
    confirmed_by_role     = COALESCE(p_confirmed_by_role,     confirmed_by_role),
    notes                 = COALESCE(p_notes,                 notes),
    assigned_responder_id = COALESCE(p_assigned_responder_id, assigned_responder_id),
    dismissed             = COALESCE(p_dismissed,             dismissed),
    status                = COALESCE(p_status,                status)
  WHERE id = p_id;

  RETURN old_rescue;
END;
$$;
