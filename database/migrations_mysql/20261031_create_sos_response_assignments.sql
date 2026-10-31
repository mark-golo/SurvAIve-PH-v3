-- Migration: Create sos_response_assignments table (MySQL / XAMPP)
-- Tracks agency acknowledgment and responder assignment per SOS incident

CREATE TABLE IF NOT EXISTS `sos_response_assignments` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sos_id`                BIGINT NOT NULL,
  `agency_id`             BIGINT UNSIGNED DEFAULT NULL,
  `agency_type`           ENUM('mdrrmo','hospital','bfp','pnp','pcg') NOT NULL,
  `status`                ENUM(
                            'pending_acknowledgment','acknowledged','declined',
                            'assigned','en_route','on_scene','completed',
                            'unable_to_respond','cancelled'
                          ) NOT NULL DEFAULT 'pending_acknowledgment',
  `assigned_responder_id` BIGINT UNSIGNED DEFAULT NULL,
  `acknowledged_by`       TEXT DEFAULT NULL,
  `acknowledged_at`       DATETIME DEFAULT NULL,
  `assigned_at`           DATETIME DEFAULT NULL,
  `completed_at`          DATETIME DEFAULT NULL,
  `decline_reason`        TEXT DEFAULT NULL,
  `created_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sos_agency` (`sos_id`, `agency_id`),
  KEY `idx_sos_id` (`sos_id`),
  KEY `idx_agency_status` (`agency_id`, `status`),
  KEY `idx_responder_status` (`assigned_responder_id`, `status`),
  CONSTRAINT `fk_sra_sos` FOREIGN KEY (`sos_id`) REFERENCES `sos_reports` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
