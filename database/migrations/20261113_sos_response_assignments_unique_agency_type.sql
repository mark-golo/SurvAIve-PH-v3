-- Fix: add UNIQUE (sos_id, agency_type) so upsert(onConflict:'sos_id,agency_type') works.
-- Previously the code used this conflict key but no matching constraint existed, causing
-- each acknowledge action to insert a new duplicate row instead of updating the existing one.

-- Remove any duplicates accumulated before this constraint was added,
-- keeping the most recent entry per (sos_id, agency_type).
DELETE FROM sos_response_assignments
WHERE id NOT IN (
  SELECT DISTINCT ON (sos_id, agency_type) id
  FROM sos_response_assignments
  ORDER BY sos_id, agency_type, created_at DESC
);

ALTER TABLE sos_response_assignments
  ADD CONSTRAINT sos_response_assignments_sos_id_agency_type_key
  UNIQUE (sos_id, agency_type);
