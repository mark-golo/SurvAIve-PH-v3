-- Migration: enforce valid values on ai_review_status (MySQL ENUM)
-- Blueprint §6.1 — AI traceability: aligns MySQL offline schema with
-- the CHECK constraint already present in the Supabase schema.

ALTER TABLE sos_reports
  MODIFY COLUMN ai_review_status
    ENUM('unreviewed','confirmed','corrected','rejected')
    NOT NULL DEFAULT 'unreviewed';
