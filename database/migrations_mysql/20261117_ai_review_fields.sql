-- Migration: AI traceability and human review fields on sos_reports (MySQL/XAMPP)
-- Blueprint §6.1 — Shared AI Output Record

ALTER TABLE sos_reports
  ADD COLUMN IF NOT EXISTS ai_classification VARCHAR(50)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_confidence     TINYINT UNSIGNED DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_rules_version  VARCHAR(20)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_review_status  VARCHAR(20)  NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS ai_review_note    TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_reviewed_by    VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at    TIMESTAMP    NULL DEFAULT NULL;
