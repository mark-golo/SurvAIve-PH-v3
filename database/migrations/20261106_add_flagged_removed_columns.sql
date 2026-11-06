-- Migration: add flagged and removed_from_view columns to sos_reports
-- Apply in Supabase dashboard SQL editor

ALTER TABLE sos_reports
  ADD COLUMN IF NOT EXISTS flagged           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS removed_from_view BOOLEAN NOT NULL DEFAULT FALSE;

-- Rebuild update_sos_by_id RPC to include the new params
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
  p_confirmed_by_role     TEXT        DEFAULT NULL,
  p_flagged               BOOLEAN     DEFAULT NULL,
  p_removed_from_view     BOOLEAN     DEFAULT NULL
)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_old TEXT;
BEGIN
  SELECT rescue_status INTO v_old FROM sos_reports WHERE id = p_id;
  UPDATE sos_reports SET
    rescue_status         = COALESCE(p_rescue_status,         rescue_status),
    confirmed_by_name     = COALESCE(p_confirmed_by_name,     confirmed_by_name),
    confirmed_at          = COALESCE(p_confirmed_at,          confirmed_at),
    confirmed_by_role     = COALESCE(p_confirmed_by_role,     confirmed_by_role),
    notes                 = COALESCE(p_notes,                 notes),
    assigned_responder_id = COALESCE(p_assigned_responder_id, assigned_responder_id),
    dismissed             = COALESCE(p_dismissed,             dismissed),
    status                = COALESCE(p_status,                status),
    flagged               = COALESCE(p_flagged,               flagged),
    removed_from_view     = COALESCE(p_removed_from_view,     removed_from_view)
  WHERE id = p_id;
  RETURN v_old;
END;
$$;
