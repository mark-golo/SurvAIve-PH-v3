-- Migration: Fix response_feedback table for victim feedback submission
-- Fixes: target_id UUID type error, RLS blocking device-auth victims, missing GRANTs

-- 1. Change target_id from UUID to TEXT — component sends service-type strings and
--    integer responder IDs, neither of which are valid UUIDs.
ALTER TABLE response_feedback ALTER COLUMN target_id TYPE TEXT USING target_id::TEXT;

-- 2. Make victim_id nullable — device-bound victims (Victim ID + PIN login) have no
--    Supabase Auth session and no row in profiles, so we cannot store a profiles UUID.
ALTER TABLE response_feedback ALTER COLUMN victim_id DROP NOT NULL;

-- 3. Drop the FK constraint on victim_id (referenced profiles(id) which device-auth
--    victims don't have). The constraint name may vary — drop by convention name and
--    also try the auto-generated name.
ALTER TABLE response_feedback DROP CONSTRAINT IF EXISTS response_feedback_victim_id_fkey;

-- 4. Drop the broken INSERT policy. The version in supabase_schema.sql contained
--    "sos_reports.user_id = auth.uid()" which is a BIGINT vs UUID type mismatch and
--    always evaluates false. Even the correct migration version requires auth.uid() =
--    victim_id, which is null for device-auth victims.
DROP POLICY IF EXISTS "victims_insert_own_feedback" ON response_feedback;

-- 5. Recreate INSERT policy: allow insert when the referenced SOS is rescued.
--    No auth.uid() check — device-auth victims have no Supabase session.
--    The PHP backend enforces ownership server-side; on the Supabase path the
--    rescue_status check is the safety gate.
CREATE POLICY "victims_insert_own_feedback" ON response_feedback
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sos_reports
      WHERE sos_reports.id = response_feedback.sos_id
        AND sos_reports.rescue_status = 'rescued'
    )
  );

-- 6. Grant INSERT and SELECT to anon and authenticated roles.
--    auto_expose_new_tables is disabled in this project so grants must be explicit.
GRANT INSERT ON response_feedback TO anon, authenticated;
GRANT SELECT ON response_feedback TO authenticated;
