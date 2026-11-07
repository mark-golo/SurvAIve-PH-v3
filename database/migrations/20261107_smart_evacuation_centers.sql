-- ============================================================
--  SurvAIve PH — Smart Evacuation Centers (Supabase)
--  Run once in the Supabase SQL Editor.
-- ============================================================

-- ── 1. Upgrade evacuation_centers with new columns ───────────────────────────
ALTER TABLE evacuation_centers
  ADD COLUMN IF NOT EXISTS current_occupancy    INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS safety_status        VARCHAR(20)  NOT NULL DEFAULT 'Unverified',
  ADD COLUMN IF NOT EXISTS operational_status   VARCHAR(20)  NOT NULL DEFAULT 'Operational',
  ADD COLUMN IF NOT EXISTS accessibility_status VARCHAR(20)  NOT NULL DEFAULT 'Unverified',
  ADD COLUMN IF NOT EXISTS overall_status       VARCHAR(25)  NOT NULL DEFAULT 'Unverified',
  ADD COLUMN IF NOT EXISTS last_verified_at     TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_updated_at      TIMESTAMPTZ  DEFAULT NULL;

-- ── 2. evacuation_center_assessments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evacuation_center_assessments (
  id                   BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  center_id            BIGINT       NOT NULL REFERENCES evacuation_centers(id) ON DELETE CASCADE,
  safety_status        VARCHAR(20)  NOT NULL DEFAULT 'Unverified',
  operational_status   VARCHAR(20)  NOT NULL DEFAULT 'Operational',
  accessibility_status VARCHAR(20)  NOT NULL DEFAULT 'Unverified',
  hazard_report        TEXT         DEFAULT NULL,
  assessment_result    VARCHAR(25)  NOT NULL DEFAULT 'Unverified',
  assessment_source    VARCHAR(50)  DEFAULT NULL,
  assessed_by          BIGINT       DEFAULT NULL,
  verified_by          BIGINT       DEFAULT NULL,
  assessed_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  verified_at          TIMESTAMPTZ  DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_ec_assessments_center ON evacuation_center_assessments(center_id);

-- ── 3. evacuation_center_resources ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evacuation_center_resources (
  id                  BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  center_id           BIGINT        NOT NULL REFERENCES evacuation_centers(id) ON DELETE CASCADE,
  resource_name       VARCHAR(100)  NOT NULL,
  quantity_available  NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit                VARCHAR(30)   NOT NULL DEFAULT 'units',
  availability_status VARCHAR(20)   NOT NULL DEFAULT 'Available',
  last_updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ec_resources_center ON evacuation_center_resources(center_id);

-- ── 4. evacuation_occupancy_logs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evacuation_occupancy_logs (
  id                 BIGINT  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  center_id          BIGINT  NOT NULL REFERENCES evacuation_centers(id) ON DELETE CASCADE,
  previous_occupancy INTEGER NOT NULL DEFAULT 0,
  updated_occupancy  INTEGER NOT NULL DEFAULT 0,
  maximum_capacity   INTEGER NOT NULL DEFAULT 0,
  available_spaces   INTEGER NOT NULL DEFAULT 0,
  updated_by_role    VARCHAR(50) DEFAULT NULL,
  recorded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ec_occupancy_center ON evacuation_occupancy_logs(center_id);

-- ── 5. evacuation_capacity_forecasts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evacuation_capacity_forecasts (
  id                  BIGINT  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  center_id           BIGINT  NOT NULL REFERENCES evacuation_centers(id) ON DELETE CASCADE,
  current_occupancy   INTEGER NOT NULL DEFAULT 0,
  projected_incoming  INTEGER NOT NULL DEFAULT 0,
  projected_occupancy INTEGER NOT NULL DEFAULT 0,
  maximum_capacity    INTEGER NOT NULL DEFAULT 0,
  projected_remaining INTEGER NOT NULL DEFAULT 0,
  forecast_status     VARCHAR(25) NOT NULL DEFAULT 'Can Accommodate',
  forecast_method     VARCHAR(30) NOT NULL DEFAULT 'deterministic',
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ec_forecasts_center ON evacuation_capacity_forecasts(center_id);

-- ── 6. evacuation_history ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evacuation_history (
  id                     BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  center_id              BIGINT       NOT NULL REFERENCES evacuation_centers(id) ON DELETE CASCADE,
  event_name             VARCHAR(200) NOT NULL,
  event_date             DATE         NOT NULL,
  previous_occupancy     INTEGER      NOT NULL DEFAULT 0,
  maximum_occupancy      INTEGER      NOT NULL DEFAULT 0,
  total_evacuees         INTEGER      NOT NULL DEFAULT 0,
  resource_summary       JSONB        DEFAULT NULL,
  utilization_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  recorded_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ec_history_center ON evacuation_history(center_id);

-- ── Enable Row Level Security (open read, auth write) ─────────────────────────
ALTER TABLE evacuation_center_assessments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE evacuation_center_resources    ENABLE ROW LEVEL SECURITY;
ALTER TABLE evacuation_occupancy_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE evacuation_capacity_forecasts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE evacuation_history             ENABLE ROW LEVEL SECURITY;

-- Allow public reads (victim app reads without auth)
CREATE POLICY IF NOT EXISTS "Public read assessments"  ON evacuation_center_assessments  FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public read resources"    ON evacuation_center_resources    FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public read occ logs"     ON evacuation_occupancy_logs      FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public read forecasts"    ON evacuation_capacity_forecasts  FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public read history"      ON evacuation_history             FOR SELECT USING (true);

-- Allow authenticated users (service_role key used by backend) full access
CREATE POLICY IF NOT EXISTS "Service write assessments" ON evacuation_center_assessments  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Service write resources"   ON evacuation_center_resources    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Service write occ logs"    ON evacuation_occupancy_logs      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Service write forecasts"   ON evacuation_capacity_forecasts  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Service write history"     ON evacuation_history             FOR ALL USING (true) WITH CHECK (true);
