-- ── Migration: Dual-Mode SOS — YOLO11 AI Analysis Columns ──────────────────
-- Run once per database instance.
-- Adds sos_mode, ai_scene_label, ai_scene_confidence, ai_detected_count
-- to sos_reports for the dual-mode SOS reporting flow (Status Mode + Photo Mode).

-- ── MySQL / XAMPP local database ────────────────────────────────────────────
ALTER TABLE sos_reports
  ADD COLUMN IF NOT EXISTS sos_mode             VARCHAR(20)      NOT NULL DEFAULT 'status'
    COMMENT 'Which SOS input mode was used: status | photo',
  ADD COLUMN IF NOT EXISTS ai_scene_label       VARCHAR(100)     DEFAULT NULL
    COMMENT 'YOLO11 classification result: scene category label',
  ADD COLUMN IF NOT EXISTS ai_scene_confidence  TINYINT UNSIGNED DEFAULT NULL
    COMMENT 'YOLO11 classification confidence score (0–100)',
  ADD COLUMN IF NOT EXISTS ai_detected_count    TINYINT UNSIGNED DEFAULT NULL
    COMMENT 'YOLO11 detection: number of persons/objects detected';

-- ── Supabase / PostgreSQL ────────────────────────────────────────────────────
-- Run these in the Supabase SQL editor (Dashboard → SQL Editor → New query):
--
-- ALTER TABLE sos_reports
--   ADD COLUMN IF NOT EXISTS sos_mode            TEXT     NOT NULL DEFAULT 'status',
--   ADD COLUMN IF NOT EXISTS ai_scene_label      TEXT     DEFAULT NULL,
--   ADD COLUMN IF NOT EXISTS ai_scene_confidence SMALLINT DEFAULT NULL,
--   ADD COLUMN IF NOT EXISTS ai_detected_count   SMALLINT DEFAULT NULL;
