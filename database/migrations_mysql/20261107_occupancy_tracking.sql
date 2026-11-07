-- Automated Evacuation Center Occupancy Tracking (MySQL)
-- Migration: 20261107_occupancy_tracking

CREATE TABLE IF NOT EXISTS evacuation_center_occupancy_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(30) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  source VARCHAR(30) NOT NULL DEFAULT 'ADMIN',
  idempotency_key VARCHAR(100) UNIQUE,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
  evacuee_ref VARCHAR(100),
  recorded_by VARCHAR(100),
  reason TEXT,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (center_id) REFERENCES evacuation_centers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS evacuation_center_checkins (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id BIGINT UNSIGNED NOT NULL,
  evacuee_id VARCHAR(100),
  evacuee_name VARCHAR(200),
  group_size INT NOT NULL DEFAULT 1,
  occupancy_event_id BIGINT UNSIGNED,
  checked_in_by VARCHAR(100),
  checked_in_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  FOREIGN KEY (center_id) REFERENCES evacuation_centers(id) ON DELETE CASCADE,
  FOREIGN KEY (occupancy_event_id) REFERENCES evacuation_center_occupancy_events(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS evacuation_center_checkouts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id BIGINT UNSIGNED NOT NULL,
  checkin_id BIGINT UNSIGNED,
  evacuee_id VARCHAR(100),
  evacuee_name VARCHAR(200),
  group_size INT NOT NULL DEFAULT 1,
  occupancy_event_id BIGINT UNSIGNED,
  checked_out_by VARCHAR(100),
  checked_out_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'Confirmed',
  FOREIGN KEY (center_id) REFERENCES evacuation_centers(id) ON DELETE CASCADE,
  FOREIGN KEY (checkin_id) REFERENCES evacuation_center_checkins(id) ON DELETE SET NULL,
  FOREIGN KEY (occupancy_event_id) REFERENCES evacuation_center_occupancy_events(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS evacuation_center_headcounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id BIGINT UNSIGNED NOT NULL,
  counted_occupancy INT NOT NULL,
  counted_by VARCHAR(100),
  verification_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  counted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (center_id) REFERENCES evacuation_centers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- New columns on evacuation_centers (safe to run multiple times)
ALTER TABLE evacuation_centers
  ADD COLUMN IF NOT EXISTS capacity_status VARCHAR(30) DEFAULT 'Not Full',
  ADD COLUMN IF NOT EXISTS last_occupancy_update DATETIME,
  ADD COLUMN IF NOT EXISTS occupancy_data_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS occupancy_verification_status VARCHAR(30) DEFAULT 'Unverified';
