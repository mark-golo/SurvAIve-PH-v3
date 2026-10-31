-- Migration: Create sos_status_events table (Supabase / PostgreSQL)
-- Append-only event log for SOS status transitions — never updated or deleted

CREATE TABLE IF NOT EXISTS sos_status_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sos_id              BIGINT NOT NULL REFERENCES sos_reports(id) ON DELETE CASCADE,
  assignment_id       UUID REFERENCES sos_response_assignments(id) ON DELETE SET NULL,
  event_type          TEXT NOT NULL,
  old_status          TEXT,
  new_status          TEXT,
  actor_role          TEXT,
  actor_id            UUID,
  actor_name_snapshot TEXT,
  message             TEXT,
  notes               TEXT,
  source              TEXT NOT NULL DEFAULT 'online'
                        CHECK (source IN ('online','offline_sync','ble_mesh','wifi_direct','system')),
  idempotency_key     UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sos_status_events_sos_id
  ON sos_status_events (sos_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sos_status_events_assignment_id
  ON sos_status_events (assignment_id);

ALTER TABLE sos_status_events ENABLE ROW LEVEL SECURITY;

-- Victims can read events for their own SOS (message field only — not notes)
CREATE POLICY "victims_read_own_events" ON sos_status_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sos_reports
      WHERE sos_reports.id = sos_status_events.sos_id
        AND sos_reports.user_id = auth.uid()
    )
  );

-- Staff can read all events in their scope
CREATE POLICY "staff_read_events" ON sos_status_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin','superadmin','response_agency','responder')
    )
  );

-- Staff can insert events (append-only: no UPDATE or DELETE policies)
CREATE POLICY "staff_insert_events" ON sos_status_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin','response_agency','responder')
    )
  );

-- System/service-role inserts are allowed via service role key (bypasses RLS)
-- No UPDATE policy — events are immutable
-- No DELETE policy — events are immutable
