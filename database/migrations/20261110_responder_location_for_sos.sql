-- Allow victim sessions to read the GPS location of the responder assigned to
-- a specific SOS report without granting broad SELECT on the responders table.
-- SECURITY DEFINER bypasses RLS; the INNER JOIN on sos_reports ensures only
-- responders currently assigned to a known SOS ID are returned.
CREATE OR REPLACE FUNCTION get_responder_location_for_sos(p_sos_id BIGINT)
RETURNS TABLE(id BIGINT, unit_name TEXT, lat NUMERIC, lng NUMERIC, last_seen_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.unit_name, r.lat, r.lng, r.last_seen_at
  FROM responders r
  INNER JOIN sos_reports sr ON sr.assigned_responder_id = r.id
  WHERE sr.id = p_sos_id;
END;
$$;
