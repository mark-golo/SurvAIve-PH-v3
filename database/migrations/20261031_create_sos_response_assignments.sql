-- Migration: Create sos_response_assignments table (Supabase / PostgreSQL)
-- Tracks agency acknowledgment and responder assignment per SOS incident

CREATE TABLE IF NOT EXISTS sos_response_assignments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sos_id                BIGINT NOT NULL REFERENCES sos_reports(id) ON DELETE CASCADE,
  agency_id             UUID REFERENCES response_agencies(id) ON DELETE SET NULL,
  agency_type           TEXT NOT NULL CHECK (agency_type IN ('mdrrmo','hospital','bfp','pnp','pcg')),
  status                TEXT NOT NULL DEFAULT 'pending_acknowledgment'
                          CHECK (status IN (
                            'pending_acknowledgment','acknowledged','declined',
                            'assigned','en_route','on_scene','completed',
                            'unable_to_respond','cancelled'
                          )),
  assigned_responder_id UUID REFERENCES responders(id) ON DELETE SET NULL,
  acknowledged_by       TEXT,
  acknowledged_at       TIMESTAMPTZ,
  assigned_at           TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  decline_reason        TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sos_id, agency_id)
);

CREATE INDEX IF NOT EXISTS idx_sos_response_assignments_sos_id
  ON sos_response_assignments (sos_id);
CREATE INDEX IF NOT EXISTS idx_sos_response_assignments_agency_status
  ON sos_response_assignments (agency_id, status);
CREATE INDEX IF NOT EXISTS idx_sos_response_assignments_responder_status
  ON sos_response_assignments (assigned_responder_id, status);

ALTER TABLE sos_response_assignments ENABLE ROW LEVEL SECURITY;

-- Staff can read assignments in their jurisdiction
CREATE POLICY "staff_read_assignments" ON sos_response_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin','superadmin','response_agency','responder')
    )
  );

-- Victims can read assignments for their own SOS
CREATE POLICY "victims_read_own_assignments" ON sos_response_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sos_reports
      WHERE sos_reports.id = sos_response_assignments.sos_id
        AND sos_reports.user_id = auth.uid()
    )
  );

-- Staff can insert/update assignments
CREATE POLICY "staff_insert_assignments" ON sos_response_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin','response_agency','responder')
    )
  );

CREATE POLICY "staff_update_assignments" ON sos_response_assignments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin','response_agency','responder')
    )
  );
