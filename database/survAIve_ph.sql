-- SurvAIve PH Database Schema
-- Run this in phpMyAdmin or via: mysql -u root survAIve_ph < survAIve_ph.sql

CREATE DATABASE IF NOT EXISTS survAIve_ph CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE survAIve_ph;

-- ============================================================
-- SUPERADMINS (DOST Provincial Director level)
-- ============================================================
CREATE TABLE IF NOT EXISTS superadmins (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(200) NOT NULL,
  contact_number VARCHAR(20) DEFAULT NULL,
  gmail          VARCHAR(200) DEFAULT NULL,
  province       VARCHAR(100) DEFAULT NULL,
  password_hash  VARCHAR(255) DEFAULT NULL,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_verified    TINYINT(1) NOT NULL DEFAULT 1,
  trust_score    VARCHAR(20) DEFAULT 'HIGH',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contact (contact_number),
  INDEX idx_province (province)
);

-- ============================================================
-- ADMINS (DRRM Municipal level)
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(200) NOT NULL,
  contact_number VARCHAR(20) DEFAULT NULL,
  gmail          VARCHAR(200) DEFAULT NULL,
  province       VARCHAR(100) DEFAULT NULL,
  municipality   VARCHAR(100) DEFAULT NULL,
  password_hash  VARCHAR(255) DEFAULT NULL,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_verified    TINYINT(1) NOT NULL DEFAULT 1,
  trust_score    VARCHAR(20) DEFAULT 'HIGH',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contact (contact_number),
  INDEX idx_municipality (municipality)
);

-- ============================================================
-- RESPONDERS (Rescue / emergency workers)
-- Auth columns merged in — no parent staff table needed
-- ============================================================
CREATE TABLE IF NOT EXISTS responders (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(200) NOT NULL,
  contact_number    VARCHAR(20) DEFAULT NULL,
  gmail             VARCHAR(200) DEFAULT NULL,
  province          VARCHAR(100) DEFAULT NULL,
  municipality      VARCHAR(100) DEFAULT NULL,
  barangay          VARCHAR(100) DEFAULT NULL,
  password_hash     VARCHAR(255) DEFAULT NULL,
  status            ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_verified       TINYINT(1) NOT NULL DEFAULT 1,
  trust_score       VARCHAR(20) DEFAULT 'HIGH',
  team_id           VARCHAR(50) DEFAULT NULL,
  unit_name         VARCHAR(100) DEFAULT NULL,
  assigned_zone     VARCHAR(200) DEFAULT NULL,
  assigned_barangay VARCHAR(100) DEFAULT NULL,
  duty_status       ENUM('on_duty','standby') NOT NULL DEFAULT 'standby',
  active_mesh_relay TINYINT(1) NOT NULL DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contact (contact_number),
  INDEX idx_municipality (municipality),
  INDEX idx_duty (duty_status)
);

-- ============================================================
-- VICTIMS (registered community members + manually entered)
-- ============================================================
CREATE TABLE IF NOT EXISTS victims (
  id                              INT AUTO_INCREMENT PRIMARY KEY,
  name                            VARCHAR(200) NOT NULL,
  contact_number                  VARCHAR(20) DEFAULT NULL,
  gmail                           VARCHAR(200) DEFAULT NULL,
  province                        VARCHAR(100) DEFAULT NULL,
  municipality                    VARCHAR(100) DEFAULT NULL,
  barangay                        VARCHAR(100) DEFAULT NULL,
  sitio                           VARCHAR(100) DEFAULT NULL,
  household_count                 TINYINT UNSIGNED DEFAULT 1,
  vulnerabilities                 JSON DEFAULT NULL,
  medical_conditions              TEXT DEFAULT NULL,
  emergency_contact_name          VARCHAR(200) DEFAULT NULL,
  emergency_contact_number        VARCHAR(20) DEFAULT NULL,
  emergency_contact_relationship  VARCHAR(50) DEFAULT NULL,
  pin_hash                        VARCHAR(255) DEFAULT NULL,
  status                          ENUM('active','sos_sent','rescued','unknown') NOT NULL DEFAULT 'active',
  is_verified                     TINYINT(1) NOT NULL DEFAULT 0,
  trust_score                     VARCHAR(20) DEFAULT 'LOW',
  created_at                      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contact (contact_number),
  INDEX idx_municipality (municipality),
  INDEX idx_barangay (barangay),
  INDEX idx_status (status)
);

-- OTP requests (for victim PIN/OTP login)
CREATE TABLE IF NOT EXISTS otp_requests (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  contact    VARCHAR(20) NOT NULL,
  otp        VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  UNIQUE KEY uq_contact (contact)
);

-- ============================================================
-- SOS Reports
-- ============================================================
CREATE TABLE IF NOT EXISTS sos_reports (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  user_id               INT DEFAULT NULL,
  barangay              VARCHAR(100) DEFAULT NULL,
  municipality          VARCHAR(100) DEFAULT NULL,
  province              VARCHAR(100) DEFAULT NULL,
  lat                   DECIMAL(10,7) DEFAULT NULL,
  lng                   DECIMAL(10,7) DEFAULT NULL,
  status                ENUM('injured','trapped','missing','safe','unknown') NOT NULL DEFAULT 'unknown',
  people_count          TINYINT UNSIGNED NOT NULL DEFAULT 1,
  notes                 TEXT DEFAULT NULL,
  is_verified           TINYINT(1) NOT NULL DEFAULT 0,
  trust_score           VARCHAR(20) DEFAULT 'LOW',
  ai_priority_score     TINYINT UNSIGNED NOT NULL DEFAULT 50,
  assigned_responder_id INT DEFAULT NULL,
  rescue_status         ENUM('pending','en_route','on_scene','rescued','cannot_reach') NOT NULL DEFAULT 'pending',
  field_notes           TEXT DEFAULT NULL,
  timestamp             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced_at             TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_municipality (municipality),
  INDEX idx_province (province),
  INDEX idx_rescue_status (rescue_status),
  INDEX idx_priority (ai_priority_score),
  INDEX idx_verified (is_verified),
  FOREIGN KEY (user_id) REFERENCES victims(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_responder_id) REFERENCES responders(id) ON DELETE SET NULL
);

-- Mesh events (simulation log)
CREATE TABLE IF NOT EXISTS mesh_events (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  device_id  VARCHAR(50) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  data       JSON DEFAULT NULL,
  timestamp  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device (device_id)
);

-- ============================================================
-- Evacuation Centers
-- ============================================================
CREATE TABLE IF NOT EXISTS evacuation_centers (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(200) NOT NULL,
  province       VARCHAR(100) DEFAULT NULL,
  municipality   VARCHAR(100) DEFAULT NULL,
  barangay       VARCHAR(100) DEFAULT NULL,
  address        TEXT DEFAULT NULL,
  lat            DECIMAL(10,7) DEFAULT NULL,
  lng            DECIMAL(10,7) DEFAULT NULL,
  capacity       INT DEFAULT NULL,
  contact_number VARCHAR(20) DEFAULT NULL,
  status         ENUM('open','closed','full') NOT NULL DEFAULT 'open',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_municipality (municipality)
);

-- ============================================================
-- Escalations
-- ============================================================
CREATE TABLE IF NOT EXISTS escalations (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  municipality      VARCHAR(100) NOT NULL,
  incident_summary  TEXT NOT NULL,
  escalation_reason TEXT DEFAULT NULL,
  response_notes    TEXT DEFAULT NULL,
  acknowledged      TINYINT(1) NOT NULL DEFAULT 0,
  escalated_by      INT DEFAULT NULL,
  timestamp         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (escalated_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Superadmin  (password: "password")
INSERT IGNORE INTO superadmins (name, contact_number, gmail, province, password_hash, status, is_verified, trust_score)
VALUES
  ('DOST Provincial Director - Caraga', '09170000001', 'dost@survAIve.ph', 'Surigao del Norte',
   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'active', 1, 'HIGH');

-- Admins  (password: "password")
INSERT IGNORE INTO admins (name, contact_number, gmail, province, municipality, password_hash, status, is_verified, trust_score)
VALUES
  ('DRRM Officer - Del Carmen', '09170000002', 'drrm.delcarmen@survAIve.ph', 'Surigao del Norte', 'Del Carmen',
   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'active', 1, 'HIGH'),
  ('DRRM Officer - Dapa', '09170000003', 'drrm.dapa@survAIve.ph', 'Surigao del Norte', 'Dapa',
   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'active', 1, 'HIGH');

-- Responders  (password: "password")
INSERT IGNORE INTO responders (name, contact_number, province, municipality, barangay, password_hash, status, is_verified, trust_score, team_id, unit_name, assigned_zone, assigned_barangay, duty_status, active_mesh_relay)
VALUES
  ('Responder Alpha-1',   '09180000001', 'Surigao del Norte', 'Del Carmen', 'Del Carmen Poblacion',
   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'active', 1, 'HIGH',
   'TEAM-A', 'Alpha Unit',   'Zone 1 – Del Carmen Poblacion', 'Del Carmen Poblacion', 'on_duty',  1),
  ('Responder Bravo-2',   '09180000002', 'Surigao del Norte', 'Del Carmen', 'Bitoon',
   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'active', 1, 'HIGH',
   'TEAM-B', 'Bravo Unit',   'Zone 2 – Bitoon',    'Bitoon',    'on_duty',  0),
  ('Responder Charlie-3', '09180000003', 'Surigao del Norte', 'Del Carmen', 'San Jose',
   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'active', 1, 'HIGH',
   'TEAM-C', 'Charlie Unit', 'Zone 3 – San Jose',     'San Jose',     'standby',  1);

-- Victims (all Del Carmen, Siargao Island)
INSERT IGNORE INTO victims (name, contact_number, province, municipality, barangay, sitio, household_count, vulnerabilities, status, is_verified, trust_score)
VALUES
  ('Maria Santos',    '09200000001', 'Surigao del Norte', 'Del Carmen', 'Del Carmen Poblacion', 'Purok 1', 4, '["Elderly (60+)","Infant (0-2 years old)"]', 'sos_sent', 1, 'HIGH'),
  ('Juan Dela Cruz',  '09200000002', 'Surigao del Norte', 'Del Carmen', 'Bitoon',    'Purok 2', 2, '["None"]',                                   'sos_sent', 1, 'HIGH'),
  ('Rosa Villanueva', '09200000003', 'Surigao del Norte', 'Del Carmen', 'Caub',      'Purok 1', 6, '["Pregnant","Person with Disability (PWD)"]', 'sos_sent', 1, 'HIGH'),
  ('Pedro Ramos',     '09200000004', 'Surigao del Norte', 'Del Carmen', 'Domoyog',   'Purok 3', 1, '["None"]',                                   'active',   1, 'HIGH'),
  ('Ana Reyes',       '09200000005', 'Surigao del Norte', 'Del Carmen', 'Esperanza', NULL,      3, '["Elderly (60+)"]',                           'rescued',  1, 'HIGH');

-- SOS reports linked to victims (Siargao coords)
INSERT IGNORE INTO sos_reports (user_id, barangay, municipality, province, lat, lng, status, people_count, notes, is_verified, trust_score, ai_priority_score, rescue_status)
SELECT id, barangay, municipality, province, 9.8527, 126.0736, 'trapped', 4, 'Floodwater rising fast, second floor', 1, 'HIGH', 92, 'pending'
FROM victims WHERE contact_number='09200000001';

INSERT IGNORE INTO sos_reports (user_id, barangay, municipality, province, lat, lng, status, people_count, notes, is_verified, trust_score, ai_priority_score, rescue_status)
SELECT id, barangay, municipality, province, 9.8720, 126.0690, 'injured', 2, 'Roof collapsed, leg injury', 1, 'HIGH', 78, 'en_route'
FROM victims WHERE contact_number='09200000002';

INSERT IGNORE INTO sos_reports (user_id, barangay, municipality, province, lat, lng, status, people_count, notes, is_verified, trust_score, ai_priority_score, rescue_status)
SELECT id, barangay, municipality, province, 9.8610, 126.0780, 'trapped', 6, 'Pregnant woman, need urgent help', 1, 'HIGH', 95, 'pending'
FROM victims WHERE contact_number='09200000003';

-- Guest SOS (anonymous reports, Del Carmen barangays)
INSERT IGNORE INTO sos_reports (barangay, municipality, province, lat, lng, status, people_count, notes, is_verified, trust_score, ai_priority_score, rescue_status)
VALUES
  ('Cancohoy', 'Del Carmen', 'Surigao del Norte', 9.8560, 126.0620, 'injured', 3, '5 children trapped inside school building', 0, 'LOW', 68, 'pending'),
  ('Caub',     'Del Carmen', 'Surigao del Norte', 9.8610, 126.0780, 'missing', 1, 'Elderly man last seen near river',          0, 'LOW', 55, 'pending'),
  ('Domoyog',  'Del Carmen', 'Surigao del Norte', 9.8450, 126.0680, 'safe',    8, 'Group at evacuation center, need supplies', 0, 'LOW', 20, 'pending');

-- Evacuation centers (Del Carmen, Siargao Island)
INSERT IGNORE INTO evacuation_centers (name, province, municipality, barangay, address, lat, lng, capacity, contact_number, status)
VALUES
  ('Del Carmen Municipal Gymnasium',    'Surigao del Norte', 'Del Carmen', 'Del Carmen Poblacion', 'Del Carmen Poblacion, Del Carmen, Siargao Island', 9.8520, 126.0730, 500, '09170001001', 'open'),
  ('Bitoon Barangay Hall',              'Surigao del Norte', 'Del Carmen', 'Bitoon',    'Bitoon, Del Carmen, Siargao Island',    9.8715, 126.0685, 150, '09170001002', 'open'),
  ('Siargao Island Sports Complex',     'Surigao del Norte', 'Del Carmen', 'San Jose',     'San Jose, Del Carmen, Siargao Island',     9.8485, 126.0845, 800, '09170001003', 'open');

-- Escalations
INSERT IGNORE INTO escalations (municipality, incident_summary, escalation_reason, acknowledged)
VALUES
  ('Del Carmen', '12 critical SOS reports unaddressed in Zones 1-3. Responder capacity exceeded.', 'Insufficient rescue teams',        0),
  ('Dapa',       'Flooding in 5 barangays. 40+ victims, only 2 active responders.',                'Request for additional resources', 1);
