-- Migration: Create sos_status_events table (MySQL / XAMPP)
-- Append-only event log for SOS status transitions

CREATE TABLE IF NOT EXISTS `sos_status_events` (
  `id`                  CHAR(36) NOT NULL,
  `sos_id`              BIGINT NOT NULL,
  `assignment_id`       BIGINT UNSIGNED DEFAULT NULL,
  `event_type`          VARCHAR(100) NOT NULL,
  `old_status`          VARCHAR(50) DEFAULT NULL,
  `new_status`          VARCHAR(50) DEFAULT NULL,
  `actor_role`          VARCHAR(50) DEFAULT NULL,
  `actor_id`            CHAR(36) DEFAULT NULL,
  `actor_name_snapshot` VARCHAR(200) DEFAULT NULL,
  `message`             TEXT DEFAULT NULL,
  `notes`               TEXT DEFAULT NULL,
  `source`              ENUM('online','offline_sync','ble_mesh','wifi_direct','system') NOT NULL DEFAULT 'online',
  `idempotency_key`     CHAR(36) NOT NULL,
  `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_idempotency_key` (`idempotency_key`),
  KEY `idx_sos_id_created` (`sos_id`, `created_at`),
  KEY `idx_assignment_id` (`assignment_id`),
  CONSTRAINT `fk_sse_sos` FOREIGN KEY (`sos_id`) REFERENCES `sos_reports` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
