-- =============================================================================
-- SUPABASE ONLY — run in Supabase Dashboard → SQL Editor
-- Do NOT run this in phpMyAdmin — PostgreSQL syntax only.
-- =============================================================================
-- Purpose: Three fixes so that a victim's SOS submission automatically
--          reflects in the Constituent Registry's STATUS column in real time.
--
-- Fix 1: AFTER INSERT trigger on sos_reports → sets victims.status = 'sos_sent'
--        when an authenticated victim submits a new SOS (mirrors the MySQL logic
--        in backend/api/sos/index.php line 132, which only writes to MySQL).
--
-- Fix 2: Enroll victims table in supabase_realtime publication so UPDATE events
--        are pushed to browser subscribers (UPDATE events were silently dropped
--        before because victims was not in the publication).
-- =============================================================================

-- ── Fix 1: SOS INSERT → sos_sent status ──────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_sos_insert_to_victim_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    UPDATE victims SET status = 'sos_sent' WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_sos_insert_to_victim ON sos_reports;
CREATE TRIGGER tr_sync_sos_insert_to_victim
  AFTER INSERT ON sos_reports
  FOR EACH ROW EXECUTE FUNCTION sync_sos_insert_to_victim_status();

-- ── Fix 2: Enable realtime events on victims ──────────────────────────────────
ALTER TABLE victims REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE victims;
