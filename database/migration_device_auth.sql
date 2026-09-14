-- =============================================================================
-- PART 1 — MySQL (XAMPP / phpMyAdmin)
-- =============================================================================
-- Run ONLY this section in phpMyAdmin → select your database → SQL tab.
-- Copy lines 1–19 only.  STOP before Part 2.
-- MySQL/MariaDB does NOT support CREATE POLICY — do not paste the section below.
-- =============================================================================

ALTER TABLE victims
  ADD COLUMN IF NOT EXISTS victim_id        VARCHAR(20)  UNIQUE DEFAULT NULL AFTER id,
  ADD COLUMN IF NOT EXISTS device_key_hash  VARCHAR(64)  DEFAULT NULL AFTER pin_hash,
  ADD COLUMN IF NOT EXISTS pin_salt         VARCHAR(64)  DEFAULT NULL AFTER device_key_hash;

-- Fast login lookups by Victim ID
CREATE INDEX IF NOT EXISTS idx_victim_id ON victims (victim_id);

-- =============================================================================
-- STOP HERE if you are running this in phpMyAdmin / MySQL.
-- Do NOT paste the section below into MySQL — it will fail.
-- =============================================================================




-- =============================================================================
-- PART 2 — Supabase (PostgreSQL)
-- =============================================================================
-- Run ONLY this section in Supabase Dashboard → SQL Editor.
-- Do NOT run this in phpMyAdmin — PostgreSQL syntax only.
-- =============================================================================

ALTER TABLE victims
  ADD COLUMN IF NOT EXISTS victim_id        TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS pin_hash         TEXT,
  ADD COLUMN IF NOT EXISTS device_key_hash  TEXT,
  ADD COLUMN IF NOT EXISTS pin_salt         TEXT;

-- Allow anonymous users to self-register as victims (device-bound, no OTP).
-- Only rows with a non-null victim_id (client-generated, unique) are accepted.
--
-- NOTE: CREATE POLICY IF NOT EXISTS requires PostgreSQL 17+.
-- Supabase runs PostgreSQL 15 — use a DO block guard instead.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'victims'
      AND policyname = 'victims_device_register'
  ) THEN
    CREATE POLICY "victims_device_register"
      ON victims
      FOR INSERT
      TO anon
      WITH CHECK (victim_id IS NOT NULL);
  END IF;
END $$;
