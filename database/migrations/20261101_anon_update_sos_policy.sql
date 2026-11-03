-- Migration: Allow Supabase anon role to UPDATE sos_reports rows.
--
-- Staff (admin, responder, agency) authenticate via PHP JWT only — Supabase treats
-- them as the anon role. Without this policy, supabase.from('sos_reports').update()
-- is silently rejected by RLS for anon, forcing a SECURITY DEFINER RPC workaround.
-- This policy lets api.put('/sos/:id') use a direct table update as the primary
-- strategy, with the SECURITY DEFINER RPC (migration 20261031) as a fallback.
--
-- Run this in the Supabase SQL Editor for your project.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sos_reports' AND policyname = 'anon_update_sos_status'
  ) THEN
    CREATE POLICY "anon_update_sos_status" ON sos_reports
    FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;
