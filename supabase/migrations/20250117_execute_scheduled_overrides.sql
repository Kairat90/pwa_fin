-- Выполнение планировщика с возможностью изменить сумму, дату и примечание

DROP FUNCTION IF EXISTS public.execute_scheduled_now(UUID);

CREATE OR REPLACE FUNCTION public.execute_scheduled_now(
    scheduled_id UUID,
    override_amount DECIMAL DEFAULT NULL,
    override_date TIMESTAMPTZ DEFAULT NULL,
    override_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    item public.scheduled_transactions%ROWTYPE;
    tx_amount DECIMAL;
    tx_date TIMESTAMPTZ;
    tx_note TEXT;
    tx_row public.transactions%ROWTYPE;
    next_date TIMESTAMPTZ;
    still_active BOOLEAN := TRUE;
    use_amount DECIMAL;
BEGIN
    SELECT * INTO item FROM public.scheduled_transactions
    WHERE id = scheduled_id AND user_id = uid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Запланированная операция не найдена';
    END IF;

    IF NOT item.is_active THEN
        RAISE EXCEPTION 'Операция неактивна';
    END IF;

    use_amount := COALESCE(override_amount, item.amount);

    IF use_amount IS NULL OR use_amount <= 0 THEN
        RAISE EXCEPTION 'Сумма должна быть больше 0';
    END IF;

    tx_amount := CASE WHEN item.type = 'expense' THEN -ABS(use_amount) ELSE ABS(use_amount) END;
    tx_date := COALESCE(override_date, NOW());

    tx_note := COALESCE(
        NULLIF(trim(override_note), ''),
        'Запланированная операция: ' || item.title ||
            CASE WHEN item.note IS NOT NULL AND item.note <> '' THEN ' — ' || item.note ELSE '' END
    );

    INSERT INTO public.transactions (user_id, account_id, category_id, amount, date, note, is_scheduled)
    VALUES (
        uid, item.account_id, item.category_id, tx_amount, tx_date, tx_note, TRUE
    )
    RETURNING * INTO tx_row;

    next_date := public.calculate_next_scheduled_date(item.next_execution_date, item.frequency, item.custom_days);

    IF item.end_date IS NOT NULL AND next_date > item.end_date THEN
        still_active := FALSE;
    END IF;

    UPDATE public.scheduled_transactions
    SET next_execution_date = next_date,
        is_active = still_active,
        last_executed_date = NOW()
    WHERE id = scheduled_id;

    RETURN jsonb_build_object('transaction', to_jsonb(tx_row));
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_scheduled_now(UUID, DECIMAL, TIMESTAMPTZ, TEXT) TO authenticated;
