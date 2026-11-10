-- ============================================================
--  Migration: Remove all Photo Mode / AI analysis columns from sos_reports
--
--  Apply to:
--    1. XAMPP MySQL:  mysql -u root survAIve_ph < migration_remove_ai_columns.sql
--                     OR paste in phpMyAdmin SQL tab
--    2. Supabase:     paste in the Supabase SQL editor
--
--  Background:
--    Photo Mode and all AI image analysis have been removed from the
--    SurvAIve PH application. The underlying DB columns are dropped here.
--    Historical SOS report rows are preserved — only the column definitions
--    are removed. Any previously stored AI values are discarded.
--
--  Columns removed:
--    Original "dual-mode SOS" era  (migration_dual_mode_sos.sql):
--      sos_mode, ai_scene_label, ai_scene_confidence, ai_detected_count
--    Florence-2 migration era  (migration_florence2.sql):
--      ai_detailed_caption, ai_objects, ai_model_name, ai_processing_mode,
--      ai_verification_status, ai_verified_by, ai_verified_at
-- ============================================================

ALTER TABLE sos_reports
  DROP COLUMN IF EXISTS sos_mode,
  DROP COLUMN IF EXISTS ai_scene_label,
  DROP COLUMN IF EXISTS ai_scene_confidence,
  DROP COLUMN IF EXISTS ai_detected_count,
  DROP COLUMN IF EXISTS ai_detailed_caption,
  DROP COLUMN IF EXISTS ai_objects,
  DROP COLUMN IF EXISTS ai_model_name,
  DROP COLUMN IF EXISTS ai_processing_mode,
  DROP COLUMN IF EXISTS ai_verification_status,
  DROP COLUMN IF EXISTS ai_verified_by,
  DROP COLUMN IF EXISTS ai_verified_at;
