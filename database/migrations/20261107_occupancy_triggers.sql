-- Supabase triggers: occupancy auto-update on checkin/checkout INSERT
-- Run in Supabase SQL Editor after 20261107_occupancy_tracking.sql

CREATE OR REPLACE FUNCTION fn_checkin_increment_occupancy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_new_occ INTEGER;
  v_capacity INTEGER;
  v_cap_status VARCHAR(30);
BEGIN
  SELECT capacity INTO v_capacity FROM evacuation_centers WHERE id = NEW.center_id;
  UPDATE evacuation_centers
    SET current_occupancy = GREATEST(0, COALESCE(current_occupancy, 0) + NEW.group_size),
        last_occupancy_update = NOW(),
        occupancy_data_source = CASE WHEN NEW.evacuee_id IS NOT NULL THEN 'QR_SCAN' ELSE 'ADMIN' END
    WHERE id = NEW.center_id
    RETURNING current_occupancy INTO v_new_occ;
  IF v_capacity IS NULL OR v_capacity <= 0 THEN
    v_cap_status := 'Unknown';
  ELSIF v_new_occ >= v_capacity THEN
    v_cap_status := 'Full';
  ELSIF v_new_occ >= v_capacity * 0.9 THEN
    v_cap_status := 'Nearly Full';
  ELSIF v_new_occ >= v_capacity * 0.7 THEN
    v_cap_status := 'Mostly Occupied';
  ELSE
    v_cap_status := 'Not Full';
  END IF;
  UPDATE evacuation_centers SET capacity_status = v_cap_status WHERE id = NEW.center_id;
  INSERT INTO evacuation_center_occupancy_events
    (center_id, event_type, quantity, source, evacuee_ref, recorded_by, occurred_at, recorded_at)
  VALUES (
    NEW.center_id, 'ARRIVAL', NEW.group_size,
    CASE WHEN NEW.evacuee_id IS NOT NULL THEN 'QR_SCAN' ELSE 'ADMIN' END,
    NEW.evacuee_id, NEW.checked_in_by, NOW(), NOW()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checkin_increment ON evacuation_center_checkins;
CREATE TRIGGER trg_checkin_increment
  AFTER INSERT ON evacuation_center_checkins
  FOR EACH ROW EXECUTE FUNCTION fn_checkin_increment_occupancy();

CREATE OR REPLACE FUNCTION fn_checkout_decrement_occupancy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_new_occ INTEGER;
  v_capacity INTEGER;
  v_cap_status VARCHAR(30);
BEGIN
  SELECT capacity INTO v_capacity FROM evacuation_centers WHERE id = NEW.center_id;
  UPDATE evacuation_centers
    SET current_occupancy = GREATEST(0, COALESCE(current_occupancy, 0) - NEW.group_size),
        last_occupancy_update = NOW(),
        occupancy_data_source = CASE WHEN NEW.evacuee_id IS NOT NULL THEN 'QR_SCAN' ELSE 'ADMIN' END
    WHERE id = NEW.center_id
    RETURNING current_occupancy INTO v_new_occ;
  IF v_capacity IS NULL OR v_capacity <= 0 THEN
    v_cap_status := 'Unknown';
  ELSIF v_new_occ >= v_capacity THEN
    v_cap_status := 'Full';
  ELSIF v_new_occ >= v_capacity * 0.9 THEN
    v_cap_status := 'Nearly Full';
  ELSIF v_new_occ >= v_capacity * 0.7 THEN
    v_cap_status := 'Mostly Occupied';
  ELSE
    v_cap_status := 'Not Full';
  END IF;
  UPDATE evacuation_centers SET capacity_status = v_cap_status WHERE id = NEW.center_id;
  INSERT INTO evacuation_center_occupancy_events
    (center_id, event_type, quantity, source, evacuee_ref, recorded_by, occurred_at, recorded_at)
  VALUES (
    NEW.center_id, 'DEPARTURE', NEW.group_size,
    CASE WHEN NEW.evacuee_id IS NOT NULL THEN 'QR_SCAN' ELSE 'ADMIN' END,
    NEW.evacuee_id, NEW.checked_out_by, NOW(), NOW()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checkout_decrement ON evacuation_center_checkouts;
CREATE TRIGGER trg_checkout_decrement
  AFTER INSERT ON evacuation_center_checkouts
  FOR EACH ROW EXECUTE FUNCTION fn_checkout_decrement_occupancy();
