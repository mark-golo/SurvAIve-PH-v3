-- Migration: Create response_feedback table (Supabase / PostgreSQL)
-- Stores post-rescue ratings submitted by victims for responders and agencies

CREATE TABLE IF NOT EXISTS response_feedback (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sos_id              BIGINT NOT NULL REFERENCES sos_reports(id) ON DELETE CASCADE,
  victim_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type         TEXT NOT NULL CHECK (target_type IN ('responder','agency')),
  target_id           UUID NOT NULL,
  rating              SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comments            TEXT,
  display_anonymously BOOLEAN NOT NULL DEFAULT FALSE,
  moderation_status   TEXT NOT NULL DEFAULT 'visible'
                        CHECK (moderation_status IN ('visible','flagged','hidden')),
  moderation_reason   TEXT,
  moderated_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  moderated_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sos_id, victim_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_response_feedback_sos_id
  ON response_feedback (sos_id);
CREATE INDEX IF NOT EXISTS idx_response_feedback_target
  ON response_feedback (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_response_feedback_victim_id
  ON response_feedback (victim_id);

ALTER TABLE response_feedback ENABLE ROW LEVEL SECURITY;

-- Victims can insert feedback for their own completed SOS
CREATE POLICY "victims_insert_own_feedback" ON response_feedback
  FOR INSERT WITH CHECK (
    auth.uid() = victim_id
    AND EXISTS (
      SELECT 1 FROM sos_reports
      WHERE sos_reports.id = response_feedback.sos_id
        AND sos_reports.user_id = auth.uid()
        AND sos_reports.rescue_status = 'rescued'
    )
  );

-- Victims can read their own submitted feedback
CREATE POLICY "victims_read_own_feedback" ON response_feedback
  FOR SELECT USING (auth.uid() = victim_id);

-- Staff can read feedback (admins: jurisdiction-scoped at app level; agencies/responders: their own targets)
CREATE POLICY "staff_read_feedback" ON response_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin','superadmin','response_agency','responder')
    )
  );

-- Admins can update moderation fields only (original rating/comments never overwritten)
CREATE POLICY "admin_moderate_feedback" ON response_feedback
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin','superadmin')
    )
  );

-- No DELETE policy for any role — feedback records are permanent
