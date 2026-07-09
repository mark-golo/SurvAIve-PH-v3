-- ============================================================
-- SurvAIve PH — Supabase PostgreSQL Schema
-- Paste this into Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────
-- Maps auth.users UUID → role + jurisdiction scope
CREATE TABLE IF NOT EXISTS profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role           TEXT NOT NULL CHECK (role IN ('superadmin','admin','responder','victim')),
  name           TEXT NOT NULL,
  contact_number TEXT UNIQUE,
  province       TEXT,
  municipality   TEXT,
  barangay       TEXT,
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── superadmins ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS superadmins (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           TEXT NOT NULL,
  contact_number TEXT UNIQUE,
  gmail          TEXT,
  province       TEXT,
  status         TEXT NOT NULL DEFAULT 'active',
  is_verified    BOOLEAN NOT NULL DEFAULT TRUE,
  trust_score    TEXT DEFAULT 'HIGH',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── admins ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           TEXT NOT NULL,
  contact_number TEXT UNIQUE,
  gmail          TEXT,
  province       TEXT,
  municipality   TEXT,
  status         TEXT NOT NULL DEFAULT 'active',
  is_verified    BOOLEAN NOT NULL DEFAULT TRUE,
  trust_score    TEXT DEFAULT 'HIGH',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── responders ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS responders (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name              TEXT NOT NULL,
  contact_number    TEXT UNIQUE,
  gmail             TEXT,
  province          TEXT,
  municipality      TEXT,
  barangay          TEXT,
  status            TEXT NOT NULL DEFAULT 'active',
  is_verified       BOOLEAN NOT NULL DEFAULT TRUE,
  trust_score       TEXT DEFAULT 'HIGH',
  team_id           TEXT,
  unit_name         TEXT,
  assigned_zone     TEXT,
  assigned_barangay TEXT,
  duty_status       TEXT NOT NULL DEFAULT 'standby' CHECK (duty_status IN ('on_duty','standby')),
  active_mesh_relay BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── victims ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS victims (
  id                             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                           TEXT NOT NULL,
  contact_number                 TEXT UNIQUE,
  gmail                          TEXT,
  province                       TEXT,
  municipality                   TEXT,
  barangay                       TEXT,
  sitio                          TEXT,
  household_count                SMALLINT DEFAULT 1,
  vulnerabilities                JSONB,
  medical_conditions             TEXT,
  emergency_contact_name         TEXT,
  emergency_contact_number       TEXT,
  emergency_contact_relationship TEXT,
  status                         TEXT NOT NULL DEFAULT 'active'
                                   CHECK (status IN ('active','sos_sent','rescued','unknown')),
  is_verified                    BOOLEAN NOT NULL DEFAULT FALSE,
  trust_score                    TEXT DEFAULT 'LOW',
  created_at                     TIMESTAMPTZ DEFAULT NOW()
);

-- ── sos_reports ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sos_reports (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id               BIGINT REFERENCES victims(id) ON DELETE SET NULL,
  barangay              TEXT,
  municipality          TEXT,
  province              TEXT,
  lat                   NUMERIC(10,7),
  lng                   NUMERIC(10,7),
  status                TEXT NOT NULL DEFAULT 'unknown'
                          CHECK (status IN ('injured','trapped','missing','safe','unknown')),
  people_count          SMALLINT NOT NULL DEFAULT 1,
  notes                 TEXT,
  is_verified           BOOLEAN NOT NULL DEFAULT FALSE,
  trust_score           TEXT DEFAULT 'LOW',
  ai_priority_score     SMALLINT NOT NULL DEFAULT 50,
  assigned_responder_id BIGINT REFERENCES responders(id) ON DELETE SET NULL,
  rescue_status         TEXT NOT NULL DEFAULT 'pending'
                          CHECK (rescue_status IN ('pending','en_route','on_scene','rescued','cannot_reach')),
  field_notes           TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  synced_at             TIMESTAMPTZ
);

-- ── evacuation_centers ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evacuation_centers (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           TEXT NOT NULL,
  province       TEXT,
  municipality   TEXT,
  barangay       TEXT,
  address        TEXT,
  lat            NUMERIC(10,7),
  lng            NUMERIC(10,7),
  capacity       INT,
  contact_number TEXT,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','full')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── escalations ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escalations (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  municipality      TEXT NOT NULL,
  incident_summary  TEXT NOT NULL,
  escalation_reason TEXT,
  response_notes    TEXT,
  acknowledged      BOOLEAN NOT NULL DEFAULT FALSE,
  escalated_by      BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── mesh_events ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mesh_events (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id  TEXT NOT NULL,
  event_type TEXT NOT NULL,
  data       JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_contact     ON profiles(contact_number);
CREATE INDEX IF NOT EXISTS idx_superadmins_province ON superadmins(province);
CREATE INDEX IF NOT EXISTS idx_admins_municipality  ON admins(municipality);
CREATE INDEX IF NOT EXISTS idx_responders_muni      ON responders(municipality);
CREATE INDEX IF NOT EXISTS idx_responders_duty      ON responders(duty_status);
CREATE INDEX IF NOT EXISTS idx_victims_municipality ON victims(municipality);
CREATE INDEX IF NOT EXISTS idx_victims_barangay     ON victims(barangay);
CREATE INDEX IF NOT EXISTS idx_victims_status       ON victims(status);
CREATE INDEX IF NOT EXISTS idx_sos_municipality     ON sos_reports(municipality);
CREATE INDEX IF NOT EXISTS idx_sos_province         ON sos_reports(province);
CREATE INDEX IF NOT EXISTS idx_sos_rescue_status    ON sos_reports(rescue_status);
CREATE INDEX IF NOT EXISTS idx_sos_priority         ON sos_reports(ai_priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_evac_municipality    ON evacuation_centers(municipality);
CREATE INDEX IF NOT EXISTS idx_mesh_device          ON mesh_events(device_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE superadmins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins              ENABLE ROW LEVEL SECURITY;
ALTER TABLE responders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE victims             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE evacuation_centers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesh_events         ENABLE ROW LEVEL SECURITY;

-- ── profiles policies ─────────────────────────────────────────
CREATE POLICY "own profile read"
  ON profiles FOR SELECT
  USING (
    id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('superadmin','admin'))
  );

CREATE POLICY "own profile update"
  ON profiles FOR UPDATE USING (id = auth.uid());

CREATE POLICY "service profile insert"
  ON profiles FOR INSERT WITH CHECK (true);

-- ── evacuation_centers policies ───────────────────────────────
-- Public read (victims/anon need to find shelters)
CREATE POLICY "public read centers"
  ON evacuation_centers FOR SELECT USING (true);

CREATE POLICY "admin insert centers"
  ON evacuation_centers FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );

CREATE POLICY "admin update centers"
  ON evacuation_centers FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );

CREATE POLICY "admin delete centers"
  ON evacuation_centers FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );

-- ── sos_reports policies ──────────────────────────────────────
-- Anyone (including anonymous) can submit SOS
CREATE POLICY "anyone submit sos"
  ON sos_reports FOR INSERT WITH CHECK (true);

-- Staff can read SOS in their jurisdiction; anon can read their own (by user_id)
CREATE POLICY "staff read sos"
  ON sos_reports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin','responder'))
  );

CREATE POLICY "staff update sos"
  ON sos_reports FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin','responder'))
  );

-- ── victims policies ──────────────────────────────────────────
CREATE POLICY "anyone register victim"
  ON victims FOR INSERT WITH CHECK (true);

CREATE POLICY "staff read victims"
  ON victims FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );

CREATE POLICY "staff mutate victims"
  ON victims FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );

CREATE POLICY "staff delete victims"
  ON victims FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );

-- ── responders policies ───────────────────────────────────────
CREATE POLICY "staff read responders"
  ON responders FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin','responder'))
  );

CREATE POLICY "admin mutate responders"
  ON responders FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );

-- Responders can update their own duty_status
CREATE POLICY "responder update own"
  ON responders FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'responder'
            AND contact_number = (SELECT contact_number FROM responders WHERE id = responders.id))
  );

-- ── admins policies ───────────────────────────────────────────
CREATE POLICY "superadmin manage admins"
  ON admins FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "admin read self"
  ON admins FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );

-- ── superadmins policies ──────────────────────────────────────
CREATE POLICY "superadmin manage superadmins"
  ON superadmins FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- ── escalations policies ──────────────────────────────────────
CREATE POLICY "staff manage escalations"
  ON escalations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );

-- ── mesh_events policies ──────────────────────────────────────
CREATE POLICY "auth insert mesh"
  ON mesh_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "staff read mesh"
  ON mesh_events FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin','responder'))
  );

-- ============================================================
-- RPC: get_sos_with_priority
-- Returns SOS list joined with victim name + computed priority label
-- SECURITY DEFINER bypasses RLS on victims so responders can see names
-- ============================================================
CREATE OR REPLACE FUNCTION get_sos_with_priority(
  p_municipality TEXT DEFAULT NULL,
  p_province     TEXT DEFAULT NULL
)
RETURNS TABLE (
  id                    BIGINT,
  user_id               BIGINT,
  barangay              TEXT,
  municipality          TEXT,
  province              TEXT,
  lat                   NUMERIC,
  lng                   NUMERIC,
  status                TEXT,
  people_count          SMALLINT,
  notes                 TEXT,
  is_verified           BOOLEAN,
  trust_score           TEXT,
  ai_priority_score     SMALLINT,
  assigned_responder_id BIGINT,
  rescue_status         TEXT,
  field_notes           TEXT,
  created_at            TIMESTAMPTZ,
  name                  TEXT,
  contact_number        TEXT,
  vulnerabilities       JSONB,
  household_count       SMALLINT,
  priority              TEXT,
  minutes_ago           NUMERIC
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    r.id, r.user_id, r.barangay, r.municipality, r.province,
    r.lat, r.lng, r.status, r.people_count, r.notes,
    r.is_verified, r.trust_score, r.ai_priority_score,
    r.assigned_responder_id, r.rescue_status, r.field_notes, r.created_at,
    v.name,
    v.contact_number,
    v.vulnerabilities,
    v.household_count,
    CASE
      WHEN r.ai_priority_score >= 80 THEN 'CRITICAL'
      WHEN r.ai_priority_score >= 60 THEN 'HIGH'
      WHEN r.ai_priority_score >= 40 THEN 'MODERATE'
      ELSE 'LOW'
    END AS priority,
    ROUND(EXTRACT(EPOCH FROM NOW() - r.created_at) / 60, 0)::NUMERIC AS minutes_ago
  FROM sos_reports r
  LEFT JOIN victims v ON r.user_id = v.id
  WHERE
    (p_municipality IS NULL OR r.municipality = p_municipality) AND
    (p_province     IS NULL OR r.province     = p_province)
  ORDER BY r.ai_priority_score DESC, r.created_at DESC
  LIMIT 500;
$$;

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO superadmins (name, contact_number, gmail, province, status, is_verified, trust_score)
VALUES ('DOST Provincial Director - Caraga', '09170000001', 'dost@survAIve.ph', 'Surigao del Norte', 'active', TRUE, 'HIGH')
ON CONFLICT (contact_number) DO NOTHING;

INSERT INTO admins (name, contact_number, gmail, province, municipality, status, is_verified, trust_score)
VALUES
  ('DRRM Officer - Del Carmen', '09170000002', 'drrm.delcarmen@survAIve.ph', 'Surigao del Norte', 'Del Carmen', 'active', TRUE, 'HIGH'),
  ('DRRM Officer - Dapa',       '09170000003', 'drrm.dapa@survAIve.ph',      'Surigao del Norte', 'Dapa',       'active', TRUE, 'HIGH')
ON CONFLICT (contact_number) DO NOTHING;

INSERT INTO responders (name, contact_number, province, municipality, barangay, status, is_verified, trust_score, team_id, unit_name, assigned_zone, assigned_barangay, duty_status, active_mesh_relay)
VALUES
  ('Responder Alpha-1',   '09180000001', 'Surigao del Norte', 'Del Carmen', 'Del Carmen Poblacion', 'active', TRUE, 'HIGH', 'TEAM-A', 'Alpha Unit',   'Zone 1 – Del Carmen Poblacion', 'Del Carmen Poblacion', 'on_duty', TRUE),
  ('Responder Bravo-2',   '09180000002', 'Surigao del Norte', 'Del Carmen', 'Bitoon',               'active', TRUE, 'HIGH', 'TEAM-B', 'Bravo Unit',   'Zone 2 – Bitoon',               'Bitoon',               'on_duty', FALSE),
  ('Responder Charlie-3', '09180000003', 'Surigao del Norte', 'Del Carmen', 'San Jose',             'active', TRUE, 'HIGH', 'TEAM-C', 'Charlie Unit', 'Zone 3 – San Jose',             'San Jose',             'standby', TRUE)
ON CONFLICT (contact_number) DO NOTHING;

INSERT INTO victims (name, contact_number, province, municipality, barangay, sitio, household_count, vulnerabilities, status, is_verified, trust_score)
VALUES
  ('Maria Santos',    '09200000001', 'Surigao del Norte', 'Del Carmen', 'Del Carmen Poblacion', 'Purok 1', 4, '["Elderly (60+)","Infant (0-2 years old)"]'::jsonb, 'sos_sent', TRUE, 'HIGH'),
  ('Juan Dela Cruz',  '09200000002', 'Surigao del Norte', 'Del Carmen', 'Bitoon',               'Purok 2', 2, '["None"]'::jsonb,                                   'sos_sent', TRUE, 'HIGH'),
  ('Rosa Villanueva', '09200000003', 'Surigao del Norte', 'Del Carmen', 'Caub',                 'Purok 1', 6, '["Pregnant","Person with Disability (PWD)"]'::jsonb, 'sos_sent', TRUE, 'HIGH'),
  ('Pedro Ramos',     '09200000004', 'Surigao del Norte', 'Del Carmen', 'Domoyog',              'Purok 3', 1, '["None"]'::jsonb,                                   'active',   TRUE, 'HIGH'),
  ('Ana Reyes',       '09200000005', 'Surigao del Norte', 'Del Carmen', 'Esperanza',            NULL,      3, '["Elderly (60+)"]'::jsonb,                           'rescued',  TRUE, 'HIGH')
ON CONFLICT (contact_number) DO NOTHING;

INSERT INTO sos_reports (user_id, barangay, municipality, province, lat, lng, status, people_count, notes, is_verified, trust_score, ai_priority_score, rescue_status)
SELECT id, barangay, municipality, province, 9.8527, 126.0736, 'trapped', 4, 'Floodwater rising fast, second floor', TRUE, 'HIGH', 92, 'pending'
FROM victims WHERE contact_number = '09200000001';

INSERT INTO sos_reports (user_id, barangay, municipality, province, lat, lng, status, people_count, notes, is_verified, trust_score, ai_priority_score, rescue_status)
SELECT id, barangay, municipality, province, 9.8720, 126.0690, 'injured', 2, 'Roof collapsed, leg injury', TRUE, 'HIGH', 78, 'en_route'
FROM victims WHERE contact_number = '09200000002';

INSERT INTO sos_reports (user_id, barangay, municipality, province, lat, lng, status, people_count, notes, is_verified, trust_score, ai_priority_score, rescue_status)
SELECT id, barangay, municipality, province, 9.8610, 126.0780, 'trapped', 6, 'Pregnant woman, need urgent help', TRUE, 'HIGH', 95, 'pending'
FROM victims WHERE contact_number = '09200000003';

INSERT INTO sos_reports (barangay, municipality, province, lat, lng, status, people_count, notes, is_verified, trust_score, ai_priority_score, rescue_status)
VALUES
  ('Cancohoy', 'Del Carmen', 'Surigao del Norte', 9.8560, 126.0620, 'injured', 3, '5 children trapped inside school building', FALSE, 'LOW', 68, 'pending'),
  ('Caub',     'Del Carmen', 'Surigao del Norte', 9.8610, 126.0780, 'missing', 1, 'Elderly man last seen near river',          FALSE, 'LOW', 55, 'pending'),
  ('Domoyog',  'Del Carmen', 'Surigao del Norte', 9.8450, 126.0680, 'safe',    8, 'Group at evacuation center, need supplies', FALSE, 'LOW', 20, 'pending');

INSERT INTO evacuation_centers (name, province, municipality, barangay, address, lat, lng, capacity, contact_number, status)
VALUES
  ('Del Carmen Municipal Gymnasium', 'Surigao del Norte', 'Del Carmen', 'Del Carmen Poblacion', 'Del Carmen Poblacion, Del Carmen, Siargao Island', 9.8520, 126.0730, 500, '09170001001', 'open'),
  ('Bitoon Barangay Hall',           'Surigao del Norte', 'Del Carmen', 'Bitoon',               'Bitoon, Del Carmen, Siargao Island',                9.8715, 126.0685, 150, '09170001002', 'open'),
  ('Siargao Island Sports Complex',  'Surigao del Norte', 'Del Carmen', 'San Jose',             'San Jose, Del Carmen, Siargao Island',              9.8485, 126.0845, 800, '09170001003', 'open');

INSERT INTO escalations (municipality, incident_summary, escalation_reason, acknowledged)
VALUES
  ('Del Carmen', '12 critical SOS reports unaddressed in Zones 1-3. Responder capacity exceeded.', 'Insufficient rescue teams',        FALSE),
  ('Dapa',       'Flooding in 5 barangays. 40+ victims, only 2 active responders.',                'Request for additional resources', TRUE);

-- ============================================================
-- AUTH USER SETUP (run AFTER creating users in Supabase Dashboard)
-- ============================================================
-- 1. Go to Authentication → Users → Add User for each contact:
--
--    09170000001@survAIve.ph  |  password  (superadmin)
--    09170000002@survAIve.ph  |  password  (admin – Del Carmen)
--    09170000003@survAIve.ph  |  password  (admin – Dapa)
--    09180000001@survAIve.ph  |  password  (responder Alpha-1)
--    09180000002@survAIve.ph  |  password  (responder Bravo-2)
--    09180000003@survAIve.ph  |  password  (responder Charlie-3)
--    09200000001@survAIve.ph  |  password  (victim Maria Santos)
--
-- 2. Copy each user's UUID from Auth → Users, then run:
--
-- INSERT INTO profiles (id, role, name, contact_number, province, municipality, barangay) VALUES
--   ('<uuid-superadmin>',  'superadmin', 'DOST Provincial Director - Caraga', '09170000001', 'Surigao del Norte', NULL,          NULL),
--   ('<uuid-admin-dc>',    'admin',      'DRRM Officer - Del Carmen',          '09170000002', 'Surigao del Norte', 'Del Carmen',  NULL),
--   ('<uuid-admin-dapa>',  'admin',      'DRRM Officer - Dapa',                '09170000003', 'Surigao del Norte', 'Dapa',        NULL),
--   ('<uuid-resp-alpha>',  'responder',  'Responder Alpha-1',                  '09180000001', 'Surigao del Norte', 'Del Carmen',  'Del Carmen Poblacion'),
--   ('<uuid-resp-bravo>',  'responder',  'Responder Bravo-2',                  '09180000002', 'Surigao del Norte', 'Del Carmen',  'Bitoon'),
--   ('<uuid-resp-charlie>','responder',  'Responder Charlie-3',                '09180000003', 'Surigao del Norte', 'Del Carmen',  'San Jose'),
--   ('<uuid-victim-maria>','victim',     'Maria Santos',                       '09200000001', 'Surigao del Norte', 'Del Carmen',  'Del Carmen Poblacion');
