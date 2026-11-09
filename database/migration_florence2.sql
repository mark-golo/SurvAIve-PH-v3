-- ============================================================
--  Migration: Add Florence-2 extended analysis fields to sos_reports
--  Replaces placeholder YOLO11 columns with richer structured output.
--
--  Apply to:
--    1. XAMPP MySQL:  run via phpMyAdmin, or:
--                     mysql -u root survAIve_ph < migration_florence2.sql
--    2. Supabase:     paste in the Supabase SQL editor
--
--  Safe to run on a database that already has the base AI columns
--  (sos_mode, ai_scene_label, ai_scene_confidence, ai_detected_count).
--  Those are retained for backward compatibility.
--
--  Rollback (bottom of this file).
-- ============================================================

ALTER TABLE sos_reports
  ADD COLUMN IF NOT EXISTS ai_detailed_caption    TEXT             DEFAULT NULL
    COMMENT 'Florence-2 <DETAILED_CAPTION> output'
    AFTER ai_scene_label,

  ADD COLUMN IF NOT EXISTS ai_objects             JSON             DEFAULT NULL
    COMMENT 'Florence-2 <OD> detected objects: [{label, bbox}]'
    AFTER ai_detailed_caption,

  ADD COLUMN IF NOT EXISTS ai_model_name          VARCHAR(50)      DEFAULT NULL
    COMMENT 'Model that produced the analysis, e.g. Florence-2-base'
    AFTER ai_objects,

  ADD COLUMN IF NOT EXISTS ai_processing_mode     VARCHAR(20)      DEFAULT NULL
    COMMENT 'online | offline | queued'
    AFTER ai_model_name,

  ADD COLUMN IF NOT EXISTS ai_verification_status VARCHAR(20)      NOT NULL DEFAULT 'unverified'
    COMMENT 'unverified | verified | rejected — set by responder/admin'
    AFTER ai_processing_mode,

  ADD COLUMN IF NOT EXISTS ai_verified_by         INT              DEFAULT NULL
    COMMENT 'FK to responders.id or admins.id'
    AFTER ai_verification_status,

  ADD COLUMN IF NOT EXISTS ai_verified_at         TIMESTAMP        NULL DEFAULT NULL
    COMMENT 'When the analysis was verified'
    AFTER ai_verified_by;

-- ── Notes on existing columns ─────────────────────────────────────────────────
-- ai_scene_label      → now stores Florence-2 <CAPTION> (brief scene description)
-- ai_scene_confidence → will be NULL for new records (Florence-2 provides no confidence score)
-- ai_detected_count   → still stores object count from <OD>

-- ── Rollback ──────────────────────────────────────────────────────────────────
-- ALTER TABLE sos_reports
--   DROP COLUMN ai_detailed_caption,
--   DROP COLUMN ai_objects,
--   DROP COLUMN ai_model_name,
--   DROP COLUMN ai_processing_mode,
--   DROP COLUMN ai_verification_status,
--   DROP COLUMN ai_verified_by,
--   DROP COLUMN ai_verified_at;
