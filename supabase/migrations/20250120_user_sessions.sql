-- =====================================================
-- Управление сеансами пользователя (список / отзыв)
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
        s.refreshed_at,
        s.user_agent,
        s.ip::TEXT,
        (current_session_id IS NOT NULL AND s.id = current_session_id) AS is_current
    FROM auth.sessions AS s
    WHERE s.user_id = uid
    ORDER BY COALESCE(s.refreshed_at, s.updated_at, s.created_at) DESC;

END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_my_session(p_session_id UUID)
RETURNS VOID
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

    IF p_session_id IS NULL THEN
        RAISE EXCEPTION 'session_id is required';
    END IF;

    BEGIN
        current_session_id := NULLIF(auth.jwt() ->> 'session_id', '')::UUID;
    EXCEPTION
        WHEN OTHERS THEN
            current_session_id := NULL;
    END;

    IF current_session_id IS NOT NULL AND p_session_id = current_session_id THEN
        RAISE EXCEPTION 'Cannot revoke the current session';
    END IF;

    DELETE FROM auth.refresh_tokens
    WHERE session_id = p_session_id
      AND user_id = uid;

    DELETE FROM auth.sessions
    WHERE id = p_session_id
      AND user_id = uid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session not found';
    END IF;

END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_other_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
    uid UUID := auth.uid();
    current_session_id UUID;
    deleted_count INTEGER := 0;
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

    IF current_session_id IS NULL THEN
        RAISE EXCEPTION 'Current session_id is missing in JWT';
    END IF;

    DELETE FROM auth.refresh_tokens
    WHERE user_id = uid
      AND session_id IS DISTINCT FROM current_session_id;

    DELETE FROM auth.sessions
    WHERE user_id = uid
      AND id IS DISTINCT FROM current_session_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;

END;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_my_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_other_sessions() TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_my_session(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_other_sessions() FROM PUBLIC;
