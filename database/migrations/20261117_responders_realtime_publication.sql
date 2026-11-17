-- Migration: Ensure responders table is in the Supabase Realtime publication
-- and that the two RPCs used for live tracking exist.
--
-- Context: ResponseTracking.jsx subscribes to the responders table via
-- supabase.channel('rt-rsp-*') and FieldMap.jsx calls update_responder_location().
-- These may already work, but this migration makes the schema authoritative.
--
-- Run once in the Supabase SQL Editor. All statements are idempotent.

-- 1. Add responders to the realtime publication (safe if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'responders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE responders;
  END IF;
END$$;

-- 2. RPC: resolve the assigned responder's current GPS coordinates for a given SOS.
--    Called by ResponseTracking.jsx on initial load.
CREATE OR REPLACE FUNCTION get_responder_location_for_sos(p_sos_id BIGINT)
RETURNS TABLE(
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  last_seen_at  TIMESTAMPTZ,
  unit_name     TEXT
) SECURITY DEFINER AS $$
  SELECT r.lat, r.lng, r.last_seen_at, r.unit_name
  FROM   sos_reports s
  JOIN   responders  r ON r.id = s.assigned_responder_id
  WHERE  s.id = p_sos_id;
$$ LANGUAGE sql;

-- 3. RPC: upsert a responder's live GPS position (called by FieldMap.jsx).
CREATE OR REPLACE FUNCTION update_responder_location(
  p_contact_number TEXT,
  p_lat            DOUBLE PRECISION,
  p_lng            DOUBLE PRECISION
) RETURNS void SECURITY DEFINER AS $$
  UPDATE responders
  SET    lat = p_lat, lng = p_lng, last_seen_at = NOW()
  WHERE  contact_number = p_contact_number;
$$ LANGUAGE sql;
