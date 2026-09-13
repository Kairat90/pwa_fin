-- =====================================================
-- Отмена перевода: удалить связанные транзакции + запись
-- (раньше delete из transfers оставлял проводки — балансы не возвращались)
-- =====================================================

-- Обновлённый create_transfer: тег tid:<uuid> для надёжной отмены
CREATE OR REPLACE FUNCTION public.create_transfer(
    from_account_id UUID,
    to_account_id UUID,
    amount DECIMAL,
    fee DECIMAL DEFAULT 0,
    date TIMESTAMPTZ DEFAULT NOW(),
    note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    from_acc accounts%ROWTYPE;
    to_acc accounts%ROWTYPE;
    total_with_fee DECIMAL;
    transfer_row transfers%ROWTYPE;
    transfer_category_id UUID;
    transfer_note TEXT;
    tid_tag TEXT;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Пользователь не авторизован';
    END IF;

    IF from_account_id = to_account_id THEN
        RAISE EXCEPTION 'Нельзя переводить на тот же счет';
    END IF;

    IF amount IS NULL OR amount <= 0 THEN
        RAISE EXCEPTION 'Сумма перевода должна быть больше 0';
    END IF;

    SELECT * INTO from_acc FROM accounts WHERE id = from_account_id AND user_id = uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Счет-отправитель не найден';
    END IF;

    SELECT * INTO to_acc FROM accounts WHERE id = to_account_id AND user_id = uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Счет-получатель не найден';
    END IF;

    total_with_fee := amount + COALESCE(fee, 0);

    SELECT id INTO transfer_category_id
    FROM categories
    WHERE user_id = uid AND name = 'Переводы' AND is_system = TRUE
    LIMIT 1;

    INSERT INTO transfers (user_id, from_account_id, to_account_id, amount, fee, date, note, status)
    VALUES (uid, from_account_id, to_account_id, amount, COALESCE(fee, 0), date, note, 'completed')
    RETURNING * INTO transfer_row;

    tid_tag := 'tid:' || transfer_row.id::TEXT;

    transfer_note := 'Перевод на счет "' || to_acc.name || '"';
    IF note IS NOT NULL AND note <> '' THEN
        transfer_note := transfer_note || ': ' || note;
    END IF;

    INSERT INTO transactions (user_id, account_id, category_id, amount, date, note, tags, is_excluded_from_budget)
    VALUES (uid, from_account_id, transfer_category_id, -total_with_fee, date, transfer_note, ARRAY['transfer', tid_tag], TRUE);

    transfer_note := 'Перевод со счета "' || from_acc.name || '"';
    IF note IS NOT NULL AND note <> '' THEN
        transfer_note := transfer_note || ': ' || note;
    END IF;

    INSERT INTO transactions (user_id, account_id, category_id, amount, date, note, tags, is_excluded_from_budget)
    VALUES (uid, to_account_id, transfer_category_id, amount, date, transfer_note, ARRAY['transfer', tid_tag], TRUE);

    RETURN to_jsonb(transfer_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_transfer(p_transfer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    tr transfers%ROWTYPE;
    total_with_fee DECIMAL;
    tid_tag TEXT;
    deleted_by_tag INTEGER := 0;
    debit_id UUID;
    credit_id UUID;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Пользователь не авторизован';
    END IF;

    IF p_transfer_id IS NULL THEN
        RAISE EXCEPTION 'transfer_id is required';
    END IF;

    SELECT * INTO tr
    FROM transfers
    WHERE id = p_transfer_id AND user_id = uid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Перевод не найден';
    END IF;

    total_with_fee := tr.amount + COALESCE(tr.fee, 0);
    tid_tag := 'tid:' || tr.id::TEXT;

    -- Новые переводы: точное совпадение по тегу tid:<uuid>
    DELETE FROM transactions
    WHERE user_id = uid
      AND tid_tag = ANY (tags);

    GET DIAGNOSTICS deleted_by_tag = ROW_COUNT;

    -- Старые переводы без tid: ближайшие парные проводки по сумме/счетам/дате
    IF deleted_by_tag = 0 THEN
        SELECT t.id INTO debit_id
        FROM transactions t
        WHERE t.user_id = uid
          AND t.account_id = tr.from_account_id
          AND t.amount = -total_with_fee
          AND 'transfer' = ANY (t.tags)
          AND t.date = tr.date
        ORDER BY ABS(EXTRACT(EPOCH FROM (t.created_at - tr.created_at)))
        LIMIT 1;

        SELECT t.id INTO credit_id
        FROM transactions t
        WHERE t.user_id = uid
          AND t.account_id = tr.to_account_id
          AND t.amount = tr.amount
          AND 'transfer' = ANY (t.tags)
          AND t.date = tr.date
        ORDER BY ABS(EXTRACT(EPOCH FROM (t.created_at - tr.created_at)))
        LIMIT 1;

        IF debit_id IS NOT NULL THEN
            DELETE FROM transactions WHERE id = debit_id AND user_id = uid;
        END IF;

        IF credit_id IS NOT NULL THEN
            DELETE FROM transactions WHERE id = credit_id AND user_id = uid;
        END IF;
    END IF;

    DELETE FROM transfers
    WHERE id = tr.id AND user_id = uid;

END;
$$;

GRANT EXECUTE ON FUNCTION public.create_transfer(UUID, UUID, DECIMAL, DECIMAL, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_transfer(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_transfer(UUID) FROM PUBLIC;
