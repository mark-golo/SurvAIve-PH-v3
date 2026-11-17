-- Migration: Remove BLE/Wi-Fi Direct mesh communication artifacts (Supabase / PostgreSQL)
--
-- The mesh communication system has been removed from SurvAIve PH; its place in the
-- mobile apps is taken by the role-based AI assistants.
--
-- KEPT intentionally: sos_reports.mesh_packet_id and its UNIQUE constraint.
-- Despite the legacy name, it is the client-generated SOS dedup UUID and the key
-- guest victims use to look up their own SOS after an offline sync.

-- 1. Drop the mesh event log (never read by any remaining code)
DROP TABLE IF EXISTS mesh_events CASCADE;

-- 2. Drop mesh-only columns
ALTER TABLE responders  DROP COLUMN IF EXISTS active_mesh_relay;
ALTER TABLE sos_reports DROP COLUMN IF EXISTS relay_source;

-- 3. Narrow sos_status_events.source — remove the mesh transport values.
-- Reclassify any existing mesh-sourced rows as offline_sync first so the
-- new CHECK can be applied.
UPDATE sos_status_events
   SET source = 'offline_sync'
 WHERE source IN ('ble_mesh', 'wifi_direct');

ALTER TABLE sos_status_events
  DROP CONSTRAINT IF EXISTS sos_status_events_source_check;
ALTER TABLE sos_status_events
  ADD CONSTRAINT sos_status_events_source_check
  CHECK (source IN ('online', 'offline_sync', 'system'));
