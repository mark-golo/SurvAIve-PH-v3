-- =============================================================================
-- PART 1 — MySQL (XAMPP / phpMyAdmin)
-- =============================================================================
-- Run ONLY this section in phpMyAdmin → select your database → SQL tab.
-- MySQL/MariaDB does NOT support CREATE OR REPLACE FUNCTION or PostgreSQL syntax.
-- =============================================================================

ALTER TABLE sos_reports
  ADD COLUMN IF NOT EXISTS name VARCHAR(200) DEFAULT NULL AFTER user_id;

-- =============================================================================
-- STOP HERE if you are running this in phpMyAdmin / MySQL.
-- Do NOT paste the section below into MySQL — it will fail.
-- =============================================================================




-- =============================================================================
-- PART 2 — Supabase (PostgreSQL)
-- =============================================================================
-- Run ONLY this section in Supabase Dashboard → SQL Editor.
-- Do NOT run this in phpMyAdmin — PostgreSQL syntax only.
-- =============================================================================

ALTER TABLE sos_reports
  ADD COLUMN IF NOT EXISTS name TEXT DEFAULT NULL;

-- Update the RPC so that if user_id is null (victim not yet in Supabase),
-- the SOS record's own name column is used as a fallback via COALESCE.
CREATE OR REPLACE FUNCTION get_sos_with_priority(
  p_municipality TEXT DEFAULT NULL,
  p_province     TEXT DEFAULT NULL
)
RETURNS TABLE (
  id                    BIGINT,
  user_id               BIGINT,
  barangay              TEXT,
  municipality          TEXT,
  province              TEXT,
  lat                   NUMERIC,
  lng                   NUMERIC,
  status                TEXT,
  people_count          SMALLINT,
  victim_age_group      TEXT,
  special_conditions    TEXT,
  notes                 TEXT,
  is_verified           BOOLEAN,
  trust_score           TEXT,
  ai_priority_score     SMALLINT,
  assigned_responder_id BIGINT,
  rescue_status         TEXT,
  field_notes           TEXT,
  created_at            TIMESTAMPTZ,
  name                  TEXT,
  contact_number        TEXT,
  vulnerabilities       JSONB,
  household_count       SMALLINT,
  priority              TEXT,
  minutes_ago           NUMERIC,
  dismissed             BOOLEAN
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    r.id, r.user_id, r.barangay, r.municipality, r.province,
    r.lat, r.lng, r.status, r.people_count, r.victim_age_group, r.special_conditions, r.notes,
    r.is_verified, r.trust_score, r.ai_priority_score,
    r.assigned_responder_id, r.rescue_status, r.field_notes, r.created_at,
    COALESCE(v.name, r.name) AS name,
    v.contact_number,
    v.vulnerabilities,
    v.household_count,
    CASE
      WHEN r.ai_priority_score >= 80 THEN 'CRITICAL'
      WHEN r.ai_priority_score >= 60 THEN 'HIGH'
      WHEN r.ai_priority_score >= 40 THEN 'MODERATE'
      ELSE 'LOW'
    END AS priority,
    ROUND(EXTRACT(EPOCH FROM NOW() - r.created_at) / 60, 0)::NUMERIC AS minutes_ago,
    r.dismissed
  FROM sos_reports r
  LEFT JOIN victims v ON r.user_id = v.id
  WHERE
    (p_municipality IS NULL OR r.municipality = p_municipality OR r.municipality IS NULL) AND
    (p_province     IS NULL OR r.province     = p_province     OR r.province     IS NULL)
  ORDER BY r.ai_priority_score DESC, r.created_at DESC
  LIMIT 500;
$$;

-- Enable Supabase realtime events (INSERT + UPDATE) for sos_reports.
-- Without this, ALL .on('postgres_changes', ...) subscriptions on this table
-- are silently ignored — live stats and auto-refresh will never fire.
ALTER TABLE sos_reports REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE sos_reports;
