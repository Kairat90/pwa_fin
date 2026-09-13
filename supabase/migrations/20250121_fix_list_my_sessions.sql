-- =====================================================
-- Fix list_my_sessions: refreshed_at в auth.sessions = timestamp (без TZ)
-- =====================================================

CREATE OR REPLACE FUNCTION public.list_my_sessions()
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    refreshed_at TIMESTAMPTZ,
    user_agent TEXT,
    ip TEXT,
    is_current BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
    uid UUID := auth.uid();
    current_session_id UUID;
BEGIN

    IF uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    BEGIN
        current_session_id := NULLIF(auth.jwt() ->> 'session_id', '')::UUID;
    EXCEPTION
        WHEN OTHERS THEN
            current_session_id := NULL;
    END;

    RETURN QUERY
    SELECT
        s.id,
        s.created_at,
        s.updated_at,
        (s.refreshed_at AT TIME ZONE 'UTC') AS refreshed_at,
        s.user_agent::TEXT,
        s.ip::TEXT,
        (current_session_id IS NOT NULL AND s.id = current_session_id) AS is_current
    FROM auth.sessions AS s
    WHERE s.user_id = uid
    ORDER BY COALESCE((s.refreshed_at AT TIME ZONE 'UTC'), s.updated_at, s.created_at) DESC;

END;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_sessions() TO authenticated;
REVOKE ALL ON FUNCTION public.list_my_sessions() FROM PUBLIC;
