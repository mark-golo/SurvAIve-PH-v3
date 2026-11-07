-- MySQL triggers: occupancy auto-update on checkin/checkout INSERT
-- Run in phpMyAdmin or via mysql CLI after 20261107_occupancy_tracking.sql

DELIMITER $$

DROP TRIGGER IF EXISTS trg_checkin_increment$$
CREATE TRIGGER trg_checkin_increment
AFTER INSERT ON evacuation_center_checkins
FOR EACH ROW
BEGIN
  DECLARE v_new_occ INT;
  DECLARE v_capacity INT;
  DECLARE v_cap_status VARCHAR(30);
  SELECT COALESCE(capacity, 0) INTO v_capacity FROM evacuation_centers WHERE id = NEW.center_id;
  UPDATE evacuation_centers
    SET current_occupancy = GREATEST(0, COALESCE(current_occupancy, 0) + NEW.group_size),
        last_occupancy_update = NOW(),
        occupancy_data_source = IF(NEW.evacuee_id IS NOT NULL, 'QR_SCAN', 'ADMIN')
  WHERE id = NEW.center_id;
  SELECT COALESCE(current_occupancy, 0) INTO v_new_occ FROM evacuation_centers WHERE id = NEW.center_id;
  IF v_capacity <= 0 THEN
    SET v_cap_status = 'Unknown';
  ELSEIF v_new_occ >= v_capacity THEN
    SET v_cap_status = 'Full';
  ELSEIF v_new_occ >= v_capacity * 0.9 THEN
    SET v_cap_status = 'Nearly Full';
  ELSEIF v_new_occ >= v_capacity * 0.7 THEN
    SET v_cap_status = 'Mostly Occupied';
  ELSE
    SET v_cap_status = 'Not Full';
  END IF;
  UPDATE evacuation_centers SET capacity_status = v_cap_status WHERE id = NEW.center_id;
  INSERT INTO evacuation_center_occupancy_events
    (center_id, event_type, quantity, source, evacuee_ref, recorded_by, occurred_at, recorded_at)
  VALUES (
    NEW.center_id, 'ARRIVAL', NEW.group_size,
    IF(NEW.evacuee_id IS NOT NULL, 'QR_SCAN', 'ADMIN'),
    NEW.evacuee_id, NEW.checked_in_by, NOW(), NOW()
  );
END$$

DROP TRIGGER IF EXISTS trg_checkout_decrement$$
CREATE TRIGGER trg_checkout_decrement
AFTER INSERT ON evacuation_center_checkouts
FOR EACH ROW
BEGIN
  DECLARE v_new_occ INT;
  DECLARE v_capacity INT;
  DECLARE v_cap_status VARCHAR(30);
  SELECT COALESCE(capacity, 0) INTO v_capacity FROM evacuation_centers WHERE id = NEW.center_id;
  UPDATE evacuation_centers
    SET current_occupancy = GREATEST(0, COALESCE(current_occupancy, 0) - NEW.group_size),
        last_occupancy_update = NOW(),
        occupancy_data_source = IF(NEW.evacuee_id IS NOT NULL, 'QR_SCAN', 'ADMIN')
  WHERE id = NEW.center_id;
  SELECT COALESCE(current_occupancy, 0) INTO v_new_occ FROM evacuation_centers WHERE id = NEW.center_id;
  IF v_capacity <= 0 THEN
    SET v_cap_status = 'Unknown';
  ELSEIF v_new_occ >= v_capacity THEN
    SET v_cap_status = 'Full';
  ELSEIF v_new_occ >= v_capacity * 0.9 THEN
    SET v_cap_status = 'Nearly Full';
  ELSEIF v_new_occ >= v_capacity * 0.7 THEN
    SET v_cap_status = 'Mostly Occupied';
  ELSE
    SET v_cap_status = 'Not Full';
  END IF;
  UPDATE evacuation_centers SET capacity_status = v_cap_status WHERE id = NEW.center_id;
  INSERT INTO evacuation_center_occupancy_events
    (center_id, event_type, quantity, source, evacuee_ref, recorded_by, occurred_at, recorded_at)
  VALUES (
    NEW.center_id, 'DEPARTURE', NEW.group_size,
    IF(NEW.evacuee_id IS NOT NULL, 'QR_SCAN', 'ADMIN'),
    NEW.evacuee_id, NEW.checked_out_by, NOW(), NOW()
  );
END$$

DELIMITER ;
