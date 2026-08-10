-- ============================================================
--  SurvAIve PH — Local XAMPP MySQL Schema
--  Database: survAIve_ph
--
--  Run this once in phpMyAdmin or via MySQL CLI:
--    mysql -u root -p survAIve_ph < local_mysql_schema.sql
--
--  Purpose: Enables offline / Wi-Fi-hotspot mode.
--    Victims connect to the Admin's hotspot → POST SOS here.
--    Admin dashboard reads from here when internet is unavailable.
--    Data syncs to Supabase cloud when internet returns.
-- ============================================================

CREATE DATABASE IF NOT EXISTS survAIve_ph CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE survAIve_ph;

-- ── Provinces ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provinces (
  id       INT          AUTO_INCREMENT PRIMARY KEY,
  name     VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

-- ── Admins ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id             INT           AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(120)  NOT NULL,
  contact_number VARCHAR(20)   UNIQUE,
  gmail          VARCHAR(120)  UNIQUE,
  password_hash  VARCHAR(255)  NOT NULL,
  province       VARCHAR(100),
  municipality   VARCHAR(100),
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Super Admins ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS superadmins (
  id             INT           AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(120)  NOT NULL,
  contact_number VARCHAR(20)   UNIQUE,
  gmail          VARCHAR(120)  UNIQUE,
  password_hash  VARCHAR(255)  NOT NULL,
  province       VARCHAR(100),
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  municipality   VARCHAR(100)  DEFAULT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Responders ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS responders (
  id             INT            AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(120)   NOT NULL,
  contact_number VARCHAR(20)    UNIQUE,
  gmail          VARCHAR(120)   UNIQUE,
  password_hash  VARCHAR(255)   NOT NULL,
  unit_name      VARCHAR(100),
  assigned_zone  VARCHAR(100),
  province       VARCHAR(100),
  municipality   VARCHAR(100),
  duty_status    ENUM('on_duty','standby') NOT NULL DEFAULT 'standby',
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  lat            DOUBLE,
  lng            DOUBLE,
  last_seen_at   TIMESTAMP NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Victims ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS victims (
  id                             INT          AUTO_INCREMENT PRIMARY KEY,
  name                           VARCHAR(120),
  contact_number                 VARCHAR(20)  UNIQUE,
  province                       VARCHAR(100),
  municipality                   VARCHAR(100),
  barangay                       VARCHAR(100),
  sitio                          VARCHAR(100),
  household_count                INT          DEFAULT 1,
  vulnerabilities                JSON,
  medical_conditions             TEXT,
  emergency_contact_name         VARCHAR(120),
  emergency_contact_number       VARCHAR(20),
  emergency_contact_relationship VARCHAR(60),
  status                         VARCHAR(50)  DEFAULT 'active',
  created_at                     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── SOS Reports ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sos_reports (
  id                INT            AUTO_INCREMENT PRIMARY KEY,
  user_id           INT            NULL REFERENCES victims(id) ON DELETE SET NULL,
  barangay          VARCHAR(100),
  municipality      VARCHAR(100),
  province          VARCHAR(100),
  lat               DOUBLE,
  lng               DOUBLE,
  status            VARCHAR(50)    DEFAULT 'unknown',
  people_count      INT            DEFAULT 1,
  victim_age_group  VARCHAR(20)    DEFAULT 'adult',
  special_conditions VARCHAR(255)  DEFAULT '',
  notes             TEXT,
  is_verified       TINYINT(1)     DEFAULT 0,
  trust_score       VARCHAR(10)    DEFAULT 'LOW',
  ai_priority_score INT            DEFAULT 50,
  rescue_status     VARCHAR(30)    DEFAULT 'pending',
  dismissed         TINYINT(1)     DEFAULT 0,
  timestamp         TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  synced_to_cloud   TINYINT(1)     DEFAULT 0  -- track which rows have been pushed to Supabase
) ENGINE=InnoDB;

-- ── Evacuation Centers ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evacuation_centers (
  id           INT          AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,
  barangay     VARCHAR(100),
  municipality VARCHAR(100),
  province     VARCHAR(100),
  capacity     INT          DEFAULT 0,
  current_count INT         DEFAULT 0,
  lat          DOUBLE,
  lng          DOUBLE,
  status       ENUM('open','full','closed') DEFAULT 'open',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
--  Staff credentials and SOS records are synced automatically
--  into these tables by the frontend on every successful online
--  login and every Command Center data fetch.
--  No manual seed data is needed.
-- ============================================================
