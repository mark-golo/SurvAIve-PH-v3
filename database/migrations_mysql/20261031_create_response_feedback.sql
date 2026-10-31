-- Migration: Create response_feedback table (MySQL / XAMPP)
-- Stores post-rescue ratings submitted by victims for responders and agencies

CREATE TABLE IF NOT EXISTS `response_feedback` (
  `id`                  CHAR(36) NOT NULL,
  `sos_id`              BIGINT NOT NULL,
  `victim_id`           BIGINT UNSIGNED NOT NULL,
  `target_type`         ENUM('responder','agency') NOT NULL,
  `target_id`           BIGINT UNSIGNED NOT NULL,
  `rating`              TINYINT UNSIGNED NOT NULL CHECK (`rating` BETWEEN 1 AND 5),
  `comments`            TEXT DEFAULT NULL,
  `display_anonymously` TINYINT(1) NOT NULL DEFAULT 0,
  `moderation_status`   ENUM('visible','flagged','hidden') NOT NULL DEFAULT 'visible',
  `moderation_reason`   TEXT DEFAULT NULL,
  `moderated_by`        BIGINT UNSIGNED DEFAULT NULL,
  `moderated_at`        DATETIME DEFAULT NULL,
  `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sos_victim_target` (`sos_id`, `victim_id`, `target_type`, `target_id`),
  KEY `idx_sos_id` (`sos_id`),
  KEY `idx_target` (`target_type`, `target_id`),
  KEY `idx_victim_id` (`victim_id`),
  CONSTRAINT `fk_rf_sos` FOREIGN KEY (`sos_id`) REFERENCES `sos_reports` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
