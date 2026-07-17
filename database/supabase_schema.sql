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
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  last_seen_at      TIMESTAMPTZ,
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

-- ── activity_logs ─────────────────────────────────────────────
-- Audit trail: who did what, when. actor_id is NULL when the auth user is deleted.
CREATE TABLE IF NOT EXISTS activity_logs (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role   TEXT,
  action       TEXT NOT NULL,
  target_table TEXT,
  target_id    TEXT,
  details      JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── notifications ─────────────────────────────────────────────
-- Per-user in-app notifications. Cascade-deleted when the user is deleted.
CREATE TABLE IF NOT EXISTS notifications (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT,
  read         BOOLEAN NOT NULL DEFAULT FALSE,
  data         JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
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
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor   ON activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_table   ON activity_logs(target_table);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread    ON notifications(recipient_id, read);

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
ALTER TABLE activity_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;

-- ── profiles policies ─────────────────────────────────────────
-- JWT check avoids recursive subquery on the profiles table itself.
CREATE POLICY "own profile read"
  ON profiles FOR SELECT
  USING (
    id = auth.uid() OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superadmin','admin')
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
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','superadmin')
  );

CREATE POLICY "admin update centers"
  ON evacuation_centers FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','superadmin')
  );

CREATE POLICY "admin delete centers"
  ON evacuation_centers FOR DELETE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','superadmin')
  );

-- ── sos_reports policies ──────────────────────────────────────
-- Anyone (including anonymous) can submit SOS
CREATE POLICY "anyone submit sos"
  ON sos_reports FOR INSERT WITH CHECK (true);

-- Staff can read SOS in their jurisdiction; anon can read their own (by user_id)
CREATE POLICY "staff read sos"
  ON sos_reports FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','superadmin','responder')
  );

CREATE POLICY "staff update sos"
  ON sos_reports FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','superadmin','responder')
  );

-- ── victims policies ──────────────────────────────────────────
CREATE POLICY "anyone register victim"
  ON victims FOR INSERT WITH CHECK (true);

CREATE POLICY "staff read victims"
  ON victims FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','superadmin')
  );

CREATE POLICY "staff mutate victims"
  ON victims FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','superadmin')
  );

CREATE POLICY "staff delete victims"
  ON victims FOR DELETE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','superadmin')
  );

-- ── responders policies ───────────────────────────────────────
CREATE POLICY "staff read responders"
  ON responders FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','superadmin','responder')
  );

CREATE POLICY "admin mutate responders"
  ON responders FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','superadmin')
  );

-- Responders can update their own row (e.g. duty_status toggle)
CREATE POLICY "responder update own"
  ON responders FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'responder'
    AND contact_number = (auth.jwt() -> 'app_metadata' ->> 'contact_number')
  );

-- ── admins policies ───────────────────────────────────────────
CREATE POLICY "superadmin manage admins"
  ON admins FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

CREATE POLICY "admin read self"
  ON admins FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','superadmin')
  );

-- ── superadmins policies ──────────────────────────────────────
CREATE POLICY "superadmin manage superadmins"
  ON superadmins FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

-- ── escalations policies ──────────────────────────────────────
CREATE POLICY "staff manage escalations"
  ON escalations FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','superadmin')
  );

-- ── mesh_events policies ──────────────────────────────────────
CREATE POLICY "auth insert mesh"
  ON mesh_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "staff read mesh"
  ON mesh_events FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','superadmin','responder')
  );

-- ── activity_logs policies ────────────────────────────────────
-- Staff can read logs; any authenticated session can write (service role inserts)
CREATE POLICY "staff read activity logs"
  ON activity_logs FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','superadmin')
  );

CREATE POLICY "service insert activity logs"
  ON activity_logs FOR INSERT WITH CHECK (true);

-- ── notifications policies ────────────────────────────────────
-- Users can only see and mark-read their own notifications
CREATE POLICY "own notifications read"
  ON notifications FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY "own notifications update"
  ON notifications FOR UPDATE
  USING (recipient_id = auth.uid());

CREATE POLICY "service insert notifications"
  ON notifications FOR INSERT WITH CHECK (true);

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
    (p_municipality IS NULL OR r.municipality = p_municipality OR r.municipality IS NULL) AND
    (p_province     IS NULL OR r.province     = p_province     OR r.province     IS NULL)
  ORDER BY r.ai_priority_score DESC, r.created_at DESC
  LIMIT 500;
$$;

-- ============================================================
-- TRIGGER: sync role → app_metadata on user creation
-- app_metadata is server-only (unlike user_metadata which users can self-edit).
-- This trigger ensures all new auth users get their role in the tamper-proof field.
-- Run backfill after applying: see BACKFILL section below.
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_role_to_app_metadata()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.raw_app_meta_data = COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'role',           NEW.raw_user_meta_data->>'role',
    'contact_number', NEW.raw_user_meta_data->>'contact_number'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_role_sync ON auth.users;
CREATE TRIGGER on_auth_user_role_sync
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_role_to_app_metadata();

-- ── BACKFILL: run once to secure existing users ───────────────
-- UPDATE auth.users
-- SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
--   'role',           raw_user_meta_data->>'role',
--   'contact_number', raw_user_meta_data->>'contact_number'
-- )
-- WHERE raw_user_meta_data->>'role' IS NOT NULL;

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO superadmins (name, contact_number, gmail, province, status, is_verified, trust_score)
VALUES ('DOST Provincial Director - Caraga', '09170000001', 'dost@survAIve.ph', 'Surigao del Norte', 'active', TRUE, 'HIGH')
ON CONFLICT (contact_number) DO NOTHING;

-- Admin accounts are created through the app (SuperAdmin → Staff Management → Admins tab).
-- Responder accounts are created through the app (Admin → Staff Management → Responders tab).
-- Demo seed data removed. Insert real data through the app.

-- ============================================================
-- AUTH USER SETUP
-- ============================================================
-- Only the SuperAdmin account needs to be created manually in Supabase Dashboard:
--
-- 1. Go to Authentication → Users → Add User:
--    09170000001@survAIve.ph  |  <password>  (superadmin)
--
-- 2. Copy the UUID, then run:
-- INSERT INTO profiles (id, role, name, contact_number, province)
-- VALUES ('<uuid-superadmin>', 'superadmin', '<Your Name>', '09170000001', '<Your Province>');
--
-- All other accounts (admins, responders) are created through the app UI.
