-- ============================================================
--  SurvAIve PH — Local XAMPP MySQL Schema  (definitive)
--  Database: survAIve_ph
--
--  Fresh install:
--    Run the entire file in phpMyAdmin (Import or SQL tab).
--
--  Upgrade existing database (already initialized from survAIve_ph.sql):
--    Scroll to the bottom ALTER TABLE section and run those statements —
--    they use IF NOT EXISTS so they are safe to run on any existing DB.
--
--  Purpose: Enables offline / Wi-Fi-hotspot mode.
--    Victims connect to the Admin's hotspot → POST SOS here.
--    Admin dashboard reads from here when internet is unavailable.
--    Staff credentials and SOS records sync automatically from the live
--    Supabase project when the admin has internet, so no seed data is needed.
-- ============================================================

CREATE DATABASE IF NOT EXISTS survAIve_ph CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE survAIve_ph;

-- ── Provinces (helper / offline location picker) ───────────────────────────────
CREATE TABLE IF NOT EXISTS provinces (
  id   INT         AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

-- ── Super Admins (DOST Provincial Director level) ─────────────────────────────
CREATE TABLE IF NOT EXISTS superadmins (
  id             INT          AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(200) NOT NULL,
  contact_number VARCHAR(20)  DEFAULT NULL,
  gmail          VARCHAR(200) DEFAULT NULL,
  province       VARCHAR(100) DEFAULT NULL,
  municipality   VARCHAR(100) DEFAULT NULL,   -- added: needed for staff sync
  password_hash  VARCHAR(255) DEFAULT NULL,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_verified    TINYINT(1)   NOT NULL DEFAULT 1,
  trust_score    VARCHAR(20)  DEFAULT 'HIGH',
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contact (contact_number),
  INDEX idx_province (province)
) ENGINE=InnoDB;

-- ── Admins (DRRM Municipal level) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id             INT          AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(200) NOT NULL,
  contact_number VARCHAR(20)  DEFAULT NULL,
  gmail          VARCHAR(200) DEFAULT NULL,
  province       VARCHAR(100) DEFAULT NULL,
  municipality   VARCHAR(100) DEFAULT NULL,
  password_hash  VARCHAR(255) DEFAULT NULL,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_verified    TINYINT(1)   NOT NULL DEFAULT 1,
  trust_score    VARCHAR(20)  DEFAULT 'HIGH',
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contact (contact_number),
  INDEX idx_municipality (municipality)
) ENGINE=InnoDB;

-- ── Responders (rescue / emergency workers) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS responders (
  id                INT          AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(200) NOT NULL,
  contact_number    VARCHAR(20)  DEFAULT NULL,
  gmail             VARCHAR(200) DEFAULT NULL,
  province          VARCHAR(100) DEFAULT NULL,
  municipality      VARCHAR(100) DEFAULT NULL,
  barangay          VARCHAR(100) DEFAULT NULL,
  password_hash     VARCHAR(255) DEFAULT NULL,
  status            ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_verified       TINYINT(1)   NOT NULL DEFAULT 1,
  trust_score       VARCHAR(20)  DEFAULT 'HIGH',
  team_id           VARCHAR(50)  DEFAULT NULL,
  unit_name         VARCHAR(100) DEFAULT NULL,
  assigned_zone     VARCHAR(200) DEFAULT NULL,
  assigned_barangay VARCHAR(100) DEFAULT NULL,
  duty_status       ENUM('on_duty','standby') NOT NULL DEFAULT 'standby',
  active_mesh_relay TINYINT(1)   NOT NULL DEFAULT 0,
  -- GPS columns synced from Supabase (not in original survAIve_ph.sql)
  lat               DOUBLE       DEFAULT NULL,
  lng               DOUBLE       DEFAULT NULL,
  last_seen_at      TIMESTAMP    NULL DEFAULT NULL,
  created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contact (contact_number),
  INDEX idx_municipality (municipality),
  INDEX idx_duty (duty_status)
) ENGINE=InnoDB;

-- ── Victims (registered community members) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS victims (
  id                              INT              AUTO_INCREMENT PRIMARY KEY,
  name                            VARCHAR(200)     NOT NULL,
  contact_number                  VARCHAR(20)      DEFAULT NULL,
  gmail                           VARCHAR(200)     DEFAULT NULL,
  province                        VARCHAR(100)     DEFAULT NULL,
  municipality                    VARCHAR(100)     DEFAULT NULL,
  barangay                        VARCHAR(100)     DEFAULT NULL,
  sitio                           VARCHAR(100)     DEFAULT NULL,
  household_count                 TINYINT UNSIGNED DEFAULT 1,
  vulnerabilities                 JSON             DEFAULT NULL,
  medical_conditions              TEXT             DEFAULT NULL,
  emergency_contact_name          VARCHAR(200)     DEFAULT NULL,
  emergency_contact_number        VARCHAR(20)      DEFAULT NULL,
  emergency_contact_relationship  VARCHAR(50)      DEFAULT NULL,
  pin_hash                        VARCHAR(255)     DEFAULT NULL,
  status                          ENUM('active','sos_sent','rescued','unknown') NOT NULL DEFAULT 'active',
  is_verified                     TINYINT(1)       NOT NULL DEFAULT 0,
  trust_score                     VARCHAR(20)      DEFAULT 'LOW',
  created_at                      TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contact (contact_number),
  INDEX idx_municipality (municipality),
  INDEX idx_barangay (barangay),
  INDEX idx_status (status)
) ENGINE=InnoDB;

-- ── OTP Requests (victim PIN / OTP login — ephemeral) ─────────────────────────
CREATE TABLE IF NOT EXISTS otp_requests (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  contact    VARCHAR(20)  NOT NULL,
  otp        VARCHAR(255) NOT NULL,
  expires_at DATETIME     NOT NULL,
  UNIQUE KEY uq_contact (contact)
) ENGINE=InnoDB;

-- ── SOS Reports ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sos_reports (
  id                     INT              AUTO_INCREMENT PRIMARY KEY,
  user_id                INT              DEFAULT NULL,
  barangay               VARCHAR(100)     DEFAULT NULL,
  municipality           VARCHAR(100)     DEFAULT NULL,
  province               VARCHAR(100)     DEFAULT NULL,
  lat                    DECIMAL(10,7)    DEFAULT NULL,
  lng                    DECIMAL(10,7)    DEFAULT NULL,
  status                 ENUM('injured','trapped','missing','safe','unknown') NOT NULL DEFAULT 'unknown',
  people_count           TINYINT UNSIGNED NOT NULL DEFAULT 1,
  victim_age_group       VARCHAR(10)      NOT NULL DEFAULT 'adult',
  special_conditions     VARCHAR(255)     NOT NULL DEFAULT '',
  notes                  TEXT             DEFAULT NULL,
  is_verified            TINYINT(1)       NOT NULL DEFAULT 0,
  trust_score            VARCHAR(20)      DEFAULT 'LOW',
  ai_priority_score      TINYINT UNSIGNED NOT NULL DEFAULT 50,
  assigned_responder_id  INT              DEFAULT NULL,
  rescue_status          ENUM('pending','en_route','on_scene','rescued','cannot_reach') NOT NULL DEFAULT 'pending',
  field_notes            TEXT             DEFAULT NULL,
  -- offline-tracking columns (not in Supabase)
  dismissed              TINYINT(1)       NOT NULL DEFAULT 0,
  synced_to_cloud        TINYINT(1)       NOT NULL DEFAULT 0,
  timestamp              TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,
  synced_at              TIMESTAMP        NULL DEFAULT NULL,
  INDEX idx_municipality (municipality),
  INDEX idx_province (province),
  INDEX idx_rescue_status (rescue_status),
  INDEX idx_priority (ai_priority_score),
  INDEX idx_verified (is_verified),
  FOREIGN KEY (user_id)               REFERENCES victims(id)    ON DELETE SET NULL,
  FOREIGN KEY (assigned_responder_id) REFERENCES responders(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Welfare Checks (daily victim check-ins) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS welfare_checks (
  id           INT  AUTO_INCREMENT PRIMARY KEY,
  victim_id    INT  NOT NULL,
  municipality VARCHAR(100) DEFAULT NULL,
  check_date   DATE NOT NULL DEFAULT (CURDATE()),
  UNIQUE KEY uq_victim_date (victim_id, check_date),
  FOREIGN KEY (victim_id) REFERENCES victims(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Evacuation Centers ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evacuation_centers (
  id             INT          AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(200) NOT NULL,
  province       VARCHAR(100) DEFAULT NULL,
  municipality   VARCHAR(100) DEFAULT NULL,
  barangay       VARCHAR(100) DEFAULT NULL,
  address        TEXT         DEFAULT NULL,
  lat            DECIMAL(10,7) DEFAULT NULL,
  lng            DECIMAL(10,7) DEFAULT NULL,
  capacity       INT          DEFAULT NULL,
  contact_number VARCHAR(20)  DEFAULT NULL,
  status         ENUM('open','closed','full') NOT NULL DEFAULT 'open',
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_municipality (municipality)
) ENGINE=InnoDB;

-- ── Escalations (admin → superadmin, online-only REST flow) ───────────────────
CREATE TABLE IF NOT EXISTS escalations (
  id                INT  AUTO_INCREMENT PRIMARY KEY,
  municipality      VARCHAR(100) NOT NULL,
  incident_summary  TEXT         NOT NULL,
  escalation_reason TEXT         DEFAULT NULL,
  response_notes    TEXT         DEFAULT NULL,
  acknowledged      TINYINT(1)   NOT NULL DEFAULT 0,
  escalated_by      INT          DEFAULT NULL,
  timestamp         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (escalated_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Mesh Events (relay simulation log) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mesh_events (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  device_id  VARCHAR(50)  NOT NULL,
  event_type VARCHAR(50)  NOT NULL,
  data       JSON         DEFAULT NULL,
  timestamp  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device (device_id)
) ENGINE=InnoDB;

-- ============================================================
--  Staff credentials and SOS records sync automatically from
--  the live Supabase project on every online login and every
--  Command Center data fetch. No manual seed data is needed.
-- ============================================================

-- ============================================================
--  UPGRADE EXISTING DATABASE
--
--  If you already initialized the database from survAIve_ph.sql,
--  run these ALTER TABLE statements to add the missing columns.
--  They use IF NOT EXISTS and are safe to run multiple times.
-- ============================================================

ALTER TABLE superadmins
  ADD COLUMN IF NOT EXISTS municipality VARCHAR(100) DEFAULT NULL AFTER province,
  ADD COLUMN IF NOT EXISTS is_verified  TINYINT(1)   NOT NULL DEFAULT 1 AFTER status,
  ADD COLUMN IF NOT EXISTS trust_score  VARCHAR(20)  DEFAULT 'HIGH'     AFTER is_verified;

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS is_verified TINYINT(1) NOT NULL DEFAULT 1 AFTER status,
  ADD COLUMN IF NOT EXISTS trust_score VARCHAR(20) DEFAULT 'HIGH'    AFTER is_verified;

ALTER TABLE responders
  ADD COLUMN IF NOT EXISTS lat             DOUBLE    DEFAULT NULL AFTER active_mesh_relay,
  ADD COLUMN IF NOT EXISTS lng             DOUBLE    DEFAULT NULL AFTER lat,
  ADD COLUMN IF NOT EXISTS last_seen_at    TIMESTAMP NULL DEFAULT NULL AFTER lng;

ALTER TABLE victims
  ADD COLUMN IF NOT EXISTS gmail       VARCHAR(200) DEFAULT NULL AFTER contact_number,
  ADD COLUMN IF NOT EXISTS pin_hash    VARCHAR(255) DEFAULT NULL AFTER emergency_contact_relationship,
  ADD COLUMN IF NOT EXISTS is_verified TINYINT(1)   NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN IF NOT EXISTS trust_score VARCHAR(20)  DEFAULT 'LOW'      AFTER is_verified;

ALTER TABLE sos_reports
  ADD COLUMN IF NOT EXISTS assigned_responder_id INT  DEFAULT NULL         AFTER ai_priority_score,
  ADD COLUMN IF NOT EXISTS field_notes           TEXT DEFAULT NULL         AFTER rescue_status,
  ADD COLUMN IF NOT EXISTS dismissed             TINYINT(1) NOT NULL DEFAULT 0 AFTER field_notes,
  ADD COLUMN IF NOT EXISTS synced_to_cloud       TINYINT(1) NOT NULL DEFAULT 0 AFTER dismissed,
  ADD COLUMN IF NOT EXISTS synced_at             TIMESTAMP NULL DEFAULT NULL   AFTER synced_to_cloud;

ALTER TABLE evacuation_centers
  ADD COLUMN IF NOT EXISTS address        TEXT        DEFAULT NULL AFTER barangay,
  ADD COLUMN IF NOT EXISTS contact_number VARCHAR(20) DEFAULT NULL AFTER capacity;
