-- Migration: Remove BLE/Wi-Fi Direct mesh communication artifacts (MySQL / XAMPP)
--
-- KEPT intentionally: sos_reports.mesh_packet_id and its UNIQUE key — it is the
-- client-generated SOS dedup UUID used by the duplicate check and guest lookup.

-- 1. Drop the mesh event log
DROP TABLE IF EXISTS `mesh_events`;

-- 2. Drop mesh-only columns (ignore errors if already removed)
ALTER TABLE `responders`  DROP COLUMN `active_mesh_relay`;
ALTER TABLE `sos_reports` DROP COLUMN `relay_source`;

-- 3. Narrow sos_status_events.source — reclassify mesh rows, then shrink the ENUM
UPDATE `sos_status_events`
   SET `source` = 'offline_sync'
 WHERE `source` IN ('ble_mesh', 'wifi_direct');

ALTER TABLE `sos_status_events`
  MODIFY `source` ENUM('online','offline_sync','system') NOT NULL DEFAULT 'online';
