-- Add 'acknowledged' to sos_reports.rescue_status allowed values.
-- The responder "Acknowledge SOS" action sets rescue_status = 'acknowledged',
-- but this value was missing from both the Supabase CHECK constraint and the
-- MySQL ENUM, causing all write strategies to fail silently.

-- ── Supabase / PostgreSQL ─────────────────────────────────────────────────────
-- Run this in the Supabase dashboard SQL Editor.

ALTER TABLE sos_reports
  DROP CONSTRAINT IF EXISTS sos_reports_rescue_status_check;

ALTER TABLE sos_reports
  ADD CONSTRAINT sos_reports_rescue_status_check
  CHECK (rescue_status IN ('pending','acknowledged','en_route','on_scene','rescued','cannot_reach'));

-- ── MySQL / XAMPP ─────────────────────────────────────────────────────────────
-- Run this in phpMyAdmin SQL tab or MySQL CLI against the survAIve_ph database.

-- ALTER TABLE sos_reports
--   MODIFY COLUMN rescue_status
--   ENUM('pending','acknowledged','en_route','on_scene','rescued','cannot_reach')
--   NOT NULL DEFAULT 'pending';
