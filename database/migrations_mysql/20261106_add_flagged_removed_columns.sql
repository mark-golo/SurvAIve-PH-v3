-- Migration: add flagged and removed_from_view columns to sos_reports
-- Apply in phpMyAdmin or MySQL CLI against the survAIve_ph database

ALTER TABLE sos_reports
  ADD COLUMN IF NOT EXISTS flagged           TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS removed_from_view TINYINT(1) NOT NULL DEFAULT 0;
