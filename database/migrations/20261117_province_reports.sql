-- Province Reports table for Supabase
-- Daily aggregate snapshots used by the Superadmin Emergency Ops Reports page.
-- Previously stored only in MySQL (XAMPP). This migration adds the equivalent
-- table to Supabase so the production PWA can read and write reports without XAMPP.
--
-- Run this in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS province_reports (
  id        BIGSERIAL PRIMARY KEY,
  province  TEXT        NOT NULL,
  date      DATE        NOT NULL,
  label     TEXT        NOT NULL DEFAULT '',
  total     INT         NOT NULL DEFAULT 0,
  critical  INT         NOT NULL DEFAULT 0,
  rescued   INT         NOT NULL DEFAULT 0,
  reporting INT         NOT NULL DEFAULT 0,
  saved_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (province, date)
);

ALTER TABLE province_reports ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user (admin, superadmin) to read all rows
DROP POLICY IF EXISTS "staff_read_province_reports" ON province_reports;
CREATE POLICY "staff_read_province_reports"
  ON province_reports FOR SELECT
  USING (true);

-- Allow any authenticated user to insert/update/delete
DROP POLICY IF EXISTS "staff_write_province_reports" ON province_reports;
CREATE POLICY "staff_write_province_reports"
  ON province_reports FOR ALL
  USING (true);
