-- =====================================================
-- Редактирование перевода.
-- Перевод = запись transfers + две проводки (списание / зачисление),
-- поэтому меняем атомарно: отмена старого + создание нового в одной транзакции БД.
-- Требует: 20250123_cancel_transfer.sql
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_transfer(
    p_transfer_id UUID,
    p_from_account_id UUID,
    p_to_account_id UUID,
    p_amount DECIMAL,
    p_fee DECIMAL DEFAULT 0,
    p_date TIMESTAMPTZ DEFAULT NOW(),
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    result JSONB;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Пользователь не авторизован';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM transfers WHERE id = p_transfer_id AND user_id = uid) THEN
        RAISE EXCEPTION 'Перевод не найден';
    END IF;

    PERFORM public.cancel_transfer(p_transfer_id);

    result := public.create_transfer(
        from_account_id => p_from_account_id,
        to_account_id => p_to_account_id,
        amount => p_amount,
        fee => COALESCE(p_fee, 0),
        date => p_date,
        note => p_note
    );

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_transfer(UUID, UUID, UUID, DECIMAL, DECIMAL, TIMESTAMPTZ, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.update_transfer(UUID, UUID, UUID, DECIMAL, DECIMAL, TIMESTAMPTZ, TEXT) FROM PUBLIC;
