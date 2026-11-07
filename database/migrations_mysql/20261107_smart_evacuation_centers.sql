-- ============================================================
--  SurvAIve PH — Smart Evacuation Centers (MySQL / XAMPP)
--  Run once in phpMyAdmin or CLI:
--    mysql -u root survAIve_ph < this_file.sql
-- ============================================================

USE survAIve_ph;

-- ── 1. Upgrade evacuation_centers with new columns ───────────────────────────
ALTER TABLE evacuation_centers
  ADD COLUMN IF NOT EXISTS current_occupancy    INT          NOT NULL DEFAULT 0           AFTER capacity,
  ADD COLUMN IF NOT EXISTS safety_status        VARCHAR(20)  NOT NULL DEFAULT 'Unverified' AFTER status,
  ADD COLUMN IF NOT EXISTS operational_status   VARCHAR(20)  NOT NULL DEFAULT 'Operational' AFTER safety_status,
  ADD COLUMN IF NOT EXISTS accessibility_status VARCHAR(20)  NOT NULL DEFAULT 'Unverified' AFTER operational_status,
  ADD COLUMN IF NOT EXISTS overall_status       VARCHAR(25)  NOT NULL DEFAULT 'Unverified' AFTER accessibility_status,
  ADD COLUMN IF NOT EXISTS last_verified_at     TIMESTAMP    NULL DEFAULT NULL             AFTER overall_status,
  ADD COLUMN IF NOT EXISTS last_updated_at      TIMESTAMP    NULL DEFAULT NULL             AFTER last_verified_at;

-- ── 2. evacuation_center_assessments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evacuation_center_assessments (
  id                   INT          AUTO_INCREMENT PRIMARY KEY,
  center_id            INT          NOT NULL,
  safety_status        VARCHAR(20)  NOT NULL DEFAULT 'Unverified',
  operational_status   VARCHAR(20)  NOT NULL DEFAULT 'Operational',
  accessibility_status VARCHAR(20)  NOT NULL DEFAULT 'Unverified',
  hazard_report        TEXT         DEFAULT NULL,
  assessment_result    VARCHAR(25)  NOT NULL DEFAULT 'Unverified',
  assessment_source    VARCHAR(50)  DEFAULT NULL,
  assessed_by          INT          DEFAULT NULL,
  verified_by          INT          DEFAULT NULL,
  assessed_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at          TIMESTAMP    NULL DEFAULT NULL,
  FOREIGN KEY (center_id) REFERENCES evacuation_centers(id) ON DELETE CASCADE,
  INDEX idx_center (center_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. evacuation_center_resources ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evacuation_center_resources (
  id                  INT           AUTO_INCREMENT PRIMARY KEY,
  center_id           INT           NOT NULL,
  resource_name       VARCHAR(100)  NOT NULL,
  quantity_available  DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit                VARCHAR(30)   NOT NULL DEFAULT 'units',
  availability_status VARCHAR(20)   NOT NULL DEFAULT 'Available',
  last_updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (center_id) REFERENCES evacuation_centers(id) ON DELETE CASCADE,
  INDEX idx_center (center_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 4. evacuation_occupancy_logs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evacuation_occupancy_logs (
  id                 INT         AUTO_INCREMENT PRIMARY KEY,
  center_id          INT         NOT NULL,
  previous_occupancy INT         NOT NULL DEFAULT 0,
  updated_occupancy  INT         NOT NULL DEFAULT 0,
  maximum_capacity   INT         NOT NULL DEFAULT 0,
  available_spaces   INT         NOT NULL DEFAULT 0,
  updated_by_role    VARCHAR(50) DEFAULT NULL,
  recorded_at        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (center_id) REFERENCES evacuation_centers(id) ON DELETE CASCADE,
  INDEX idx_center (center_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 5. evacuation_capacity_forecasts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evacuation_capacity_forecasts (
  id                  INT         AUTO_INCREMENT PRIMARY KEY,
  center_id           INT         NOT NULL,
  current_occupancy   INT         NOT NULL DEFAULT 0,
  projected_incoming  INT         NOT NULL DEFAULT 0,
  projected_occupancy INT         NOT NULL DEFAULT 0,
  maximum_capacity    INT         NOT NULL DEFAULT 0,
  projected_remaining INT         NOT NULL DEFAULT 0,
  forecast_status     VARCHAR(25) NOT NULL DEFAULT 'Can Accommodate',
  forecast_method     VARCHAR(30) NOT NULL DEFAULT 'deterministic',
  generated_at        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (center_id) REFERENCES evacuation_centers(id) ON DELETE CASCADE,
  INDEX idx_center (center_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 6. evacuation_history ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evacuation_history (
  id                     INT          AUTO_INCREMENT PRIMARY KEY,
  center_id              INT          NOT NULL,
  event_name             VARCHAR(200) NOT NULL,
  event_date             DATE         NOT NULL,
  previous_occupancy     INT          NOT NULL DEFAULT 0,
  maximum_occupancy      INT          NOT NULL DEFAULT 0,
  total_evacuees         INT          NOT NULL DEFAULT 0,
  resource_summary       JSON         DEFAULT NULL,
  utilization_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  recorded_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (center_id) REFERENCES evacuation_centers(id) ON DELETE CASCADE,
  INDEX idx_center (center_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
