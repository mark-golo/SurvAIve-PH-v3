-- Migration: SECURITY DEFINER RPC for victim-scoped SOS reads
-- Allows victims (who have no Supabase Auth session) to read their own SOS records
-- by passing their device victim_id. Bypasses RLS safely because:
--   1. Filter is by victim_id TEXT (non-sequential device string, hard to enumerate)
--   2. Function is SECURITY DEFINER so callers cannot alter the filter
--   3. Only returns rows whose user_id matches the victim's Supabase victims.id

CREATE OR REPLACE FUNCTION get_victim_sos_reports(p_victim_id TEXT)
RETURNS SETOF sos_reports
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sr.*
  FROM   sos_reports sr
  JOIN   victims v ON v.id = sr.user_id
  WHERE  v.victim_id = p_victim_id
  ORDER  BY sr.created_at DESC
  LIMIT  100;
$$;
