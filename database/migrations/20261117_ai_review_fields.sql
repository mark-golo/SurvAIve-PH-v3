-- Migration: AI traceability and human review fields on sos_reports
-- Blueprint §6.1 — Shared AI Output Record
-- Adds: ai_classification, ai_confidence, ai_rules_version (output traceability)
--       ai_review_status, ai_review_note, ai_reviewed_by, ai_reviewed_at (human validation)

ALTER TABLE sos_reports
  ADD COLUMN IF NOT EXISTS ai_classification TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence     SMALLINT,
  ADD COLUMN IF NOT EXISTS ai_rules_version  TEXT,
  ADD COLUMN IF NOT EXISTS ai_review_status  TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (ai_review_status IN ('unreviewed','confirmed','corrected','rejected')),
  ADD COLUMN IF NOT EXISTS ai_review_note    TEXT,
  ADD COLUMN IF NOT EXISTS ai_reviewed_by    TEXT,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at    TIMESTAMPTZ;

COMMENT ON COLUMN sos_reports.ai_classification IS 'Primary incident category from emergencyIntelligence.classifyIncident()';
COMMENT ON COLUMN sos_reports.ai_confidence     IS 'Classification confidence 0–100 from classifyIncident()';
COMMENT ON COLUMN sos_reports.ai_rules_version  IS 'Version tag of the rules/lexicon used (e.g. 1.0)';
COMMENT ON COLUMN sos_reports.ai_review_status  IS 'Human validation state: unreviewed|confirmed|corrected|rejected';
COMMENT ON COLUMN sos_reports.ai_review_note    IS 'Free-text explanation when status is corrected or rejected';
COMMENT ON COLUMN sos_reports.ai_reviewed_by    IS 'Name of the responder or admin who reviewed the AI output';
COMMENT ON COLUMN sos_reports.ai_reviewed_at    IS 'Timestamp of the review action';
