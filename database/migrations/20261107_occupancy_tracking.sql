-- Automated Evacuation Center Occupancy Tracking
-- Migration: 20261107_occupancy_tracking

CREATE TABLE IF NOT EXISTS evacuation_center_occupancy_events (
  id BIGSERIAL PRIMARY KEY,
  center_id BIGINT NOT NULL REFERENCES evacuation_centers(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('ARRIVAL','DEPARTURE','MANUAL_ADJUSTMENT','PHYSICAL_HEADCOUNT')),
  quantity INTEGER NOT NULL DEFAULT 1,
  source VARCHAR(30) NOT NULL DEFAULT 'ADMIN',
  idempotency_key VARCHAR(100) UNIQUE,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
  evacuee_ref VARCHAR(100),
  recorded_by VARCHAR(100),
  reason TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evacuation_center_checkins (
  id BIGSERIAL PRIMARY KEY,
  center_id BIGINT NOT NULL REFERENCES evacuation_centers(id) ON DELETE CASCADE,
  evacuee_id VARCHAR(100),
  evacuee_name VARCHAR(200),
  group_size INTEGER NOT NULL DEFAULT 1,
  occupancy_event_id BIGINT REFERENCES evacuation_center_occupancy_events(id),
  checked_in_by VARCHAR(100),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS evacuation_center_checkouts (
  id BIGSERIAL PRIMARY KEY,
  center_id BIGINT NOT NULL REFERENCES evacuation_centers(id) ON DELETE CASCADE,
  checkin_id BIGINT REFERENCES evacuation_center_checkins(id),
  evacuee_id VARCHAR(100),
  evacuee_name VARCHAR(200),
  group_size INTEGER NOT NULL DEFAULT 1,
  occupancy_event_id BIGINT REFERENCES evacuation_center_occupancy_events(id),
  checked_out_by VARCHAR(100),
  checked_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'Confirmed'
);

CREATE TABLE IF NOT EXISTS evacuation_center_headcounts (
  id BIGSERIAL PRIMARY KEY,
  center_id BIGINT NOT NULL REFERENCES evacuation_centers(id) ON DELETE CASCADE,
  counted_occupancy INTEGER NOT NULL,
  counted_by VARCHAR(100),
  verification_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  counted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- New columns on evacuation_centers
ALTER TABLE evacuation_centers
  ADD COLUMN IF NOT EXISTS capacity_status VARCHAR(30) DEFAULT 'Not Full',
  ADD COLUMN IF NOT EXISTS last_occupancy_update TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS occupancy_data_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS occupancy_verification_status VARCHAR(30) DEFAULT 'Unverified';

-- RLS policies
ALTER TABLE evacuation_center_occupancy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE evacuation_center_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE evacuation_center_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evacuation_center_headcounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_occ_events" ON evacuation_center_occupancy_events;
CREATE POLICY "read_occ_events" ON evacuation_center_occupancy_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "insert_occ_events" ON evacuation_center_occupancy_events;
CREATE POLICY "insert_occ_events" ON evacuation_center_occupancy_events FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "read_checkins" ON evacuation_center_checkins;
CREATE POLICY "read_checkins" ON evacuation_center_checkins FOR SELECT USING (true);
DROP POLICY IF EXISTS "insert_checkins" ON evacuation_center_checkins;
CREATE POLICY "insert_checkins" ON evacuation_center_checkins FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "update_checkins" ON evacuation_center_checkins;
CREATE POLICY "update_checkins" ON evacuation_center_checkins FOR UPDATE USING (true);

DROP POLICY IF EXISTS "read_checkouts" ON evacuation_center_checkouts;
CREATE POLICY "read_checkouts" ON evacuation_center_checkouts FOR SELECT USING (true);
DROP POLICY IF EXISTS "insert_checkouts" ON evacuation_center_checkouts;
CREATE POLICY "insert_checkouts" ON evacuation_center_checkouts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "read_headcounts" ON evacuation_center_headcounts;
CREATE POLICY "read_headcounts" ON evacuation_center_headcounts FOR SELECT USING (true);
DROP POLICY IF EXISTS "insert_headcounts" ON evacuation_center_headcounts;
CREATE POLICY "insert_headcounts" ON evacuation_center_headcounts FOR INSERT WITH CHECK (true);
