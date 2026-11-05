-- Migration: Fix admin visibility of victim feedback in Response Feedback module
-- Root cause: 20261105 migration dropped victim_id FK, breaking PostgREST join
--   victim:profiles!victim_id used by the admin query in ResponseFeedback.jsx.
--   Without the FK, the entire Supabase query fails silently → admin sees no rows.
-- Also adds missing GRANT UPDATE needed for admin moderation actions.

-- 1. Null out any orphaned victim_id values before re-adding the FK constraint.
--    Prevents ALTER TABLE from failing if any UUID no longer exists in profiles.
UPDATE response_feedback
SET victim_id = NULL
WHERE victim_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = response_feedback.victim_id);

-- 2. Re-add victim_id FK as nullable with ON DELETE SET NULL.
--    NULL values skip FK enforcement → device-auth victims (no profiles row) still insert.
--    Non-null values must reference a real profiles row → PostgREST join resolves again.
ALTER TABLE response_feedback
  ADD CONSTRAINT response_feedback_victim_id_fkey
  FOREIGN KEY (victim_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. Victims read their own feedback (registered victims with Supabase Auth)
DROP POLICY IF EXISTS "victims_read_own_feedback" ON response_feedback;
CREATE POLICY "victims_read_own_feedback" ON response_feedback
  FOR SELECT USING (auth.uid() = victim_id);

-- 4. Staff / admin read all feedback
DROP POLICY IF EXISTS "staff_read_feedback" ON response_feedback;
CREATE POLICY "staff_read_feedback" ON response_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin','superadmin','response_agency','responder')
    )
  );

-- 5. Admin moderation (UPDATE rows)
DROP POLICY IF EXISTS "admin_moderate_feedback" ON response_feedback;
CREATE POLICY "admin_moderate_feedback" ON response_feedback
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin','superadmin')
    )
  );

-- 6. Full grants — UPDATE was missing, causing silent failures on moderation actions
GRANT INSERT ON response_feedback TO anon;
GRANT SELECT, INSERT, UPDATE ON response_feedback TO authenticated;
