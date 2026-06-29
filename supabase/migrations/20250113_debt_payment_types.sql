-- Типы операций по долгу: погашение / увеличение, редактирование и удаление

ALTER TABLE public.debt_payments
    ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'repayment'
        CHECK (entry_type IN ('repayment', 'increase'));

COMMENT ON COLUMN public.debt_payments.entry_type IS 'repayment — погашение, increase — увеличение долга';

-- Пересчёт статуса долга после изменений в операциях
CREATE OR REPLACE FUNCTION public.recalculate_debt_status(p_debt_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    debt_row public.debts%ROWTYPE;
    paid_amount DECIMAL;
    remaining_amount DECIMAL;
BEGIN
    SELECT * INTO debt_row FROM public.debts WHERE id = p_debt_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF debt_row.status = 'writtenOff' THEN
        RETURN;
    END IF;

    SELECT COALESCE(SUM(dp.amount), 0) INTO paid_amount
    FROM public.debt_payments dp
    WHERE dp.debt_id = p_debt_id AND dp.entry_type = 'repayment';

    remaining_amount := debt_row.amount - paid_amount;

    IF remaining_amount <= 0 THEN
        UPDATE public.debts
        SET status = 'settled',
            settled_date = COALESCE(settled_date, NOW()),
            updated_at = NOW()
        WHERE id = p_debt_id;
    ELSE
        UPDATE public.debts
        SET status = CASE
                WHEN debt_row.due_date IS NOT NULL AND debt_row.due_date < NOW() THEN 'overdue'
                ELSE 'active'
            END,
            settled_date = NULL,
            updated_at = NOW()
        WHERE id = p_debt_id;
    END IF;
END;
$$;

-- Создание транзакции для операции по долгу
CREATE OR REPLACE FUNCTION public.create_debt_entry_transaction(
    p_debt public.debts,
    p_contact_name TEXT,
    p_amount DECIMAL,
    p_entry_type TEXT,
    p_date TIMESTAMPTZ,
    p_note TEXT,
    p_account_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    category_id UUID;
    category_name TEXT;
    tx_amount DECIMAL;
    tx_id UUID;
    prefix TEXT;
BEGIN
    IF p_account_id IS NULL THEN
        RETURN NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.id = p_account_id AND a.user_id = uid AND NOT a.is_archived
    ) THEN
        RAISE EXCEPTION 'Счёт не найден или недоступен';
    END IF;

    IF p_entry_type = 'repayment' THEN
        category_name := CASE WHEN p_debt.type = 'iOwe' THEN 'Долги' ELSE 'Возврат долгов' END;
        prefix := 'Платеж по долгу: ';
        tx_amount := CASE WHEN p_debt.type = 'iOwe' THEN -p_amount ELSE p_amount END;
    ELSE
        category_name := CASE WHEN p_debt.type = 'iOwe' THEN 'Долги' ELSE 'Возврат долгов' END;
        prefix := 'Увеличение долга: ';
        tx_amount := CASE WHEN p_debt.type = 'iOwe' THEN p_amount ELSE -p_amount END;
    END IF;

    SELECT c.id INTO category_id FROM public.categories c
    WHERE c.user_id = uid AND c.name = category_name AND c.is_system = TRUE
    LIMIT 1;

    IF category_id IS NULL THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.transactions (user_id, account_id, category_id, amount, date, note, tags)
    VALUES (
        uid,
        p_account_id,
        category_id,
        tx_amount,
        p_date,
        prefix || p_contact_name ||
            CASE WHEN p_note IS NOT NULL AND p_note <> '' THEN ': ' || p_note ELSE '' END,
        ARRAY['debt', p_entry_type]
    )
    RETURNING id INTO tx_id;

    RETURN tx_id;
END;
$$;

DROP FUNCTION IF EXISTS public.add_debt_payment(UUID, DECIMAL, TIMESTAMPTZ, TEXT, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION public.add_debt_payment(
    debt_id UUID,
    amount DECIMAL,
    date TIMESTAMPTZ DEFAULT NOW(),
    note TEXT DEFAULT NULL,
    create_transaction BOOLEAN DEFAULT TRUE,
    payment_account_id UUID DEFAULT NULL,
    entry_type TEXT DEFAULT 'repayment'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    debt_row public.debts%ROWTYPE;
    contact_row public.contacts%ROWTYPE;
    paid_amount DECIMAL;
    remaining_amount DECIMAL;
    payment_row public.debt_payments%ROWTYPE;
    tx_account_id UUID;
    tx_id UUID;
    new_remaining DECIMAL;
    normalized_type TEXT := COALESCE(NULLIF(trim(entry_type), ''), 'repayment');
BEGIN
    IF normalized_type NOT IN ('repayment', 'increase') THEN
        RAISE EXCEPTION 'Неверный тип операции';
    END IF;

    IF amount IS NULL OR amount <= 0 THEN
        RAISE EXCEPTION 'Сумма должна быть больше 0';
    END IF;

    SELECT d.* INTO debt_row FROM public.debts d
    WHERE d.id = add_debt_payment.debt_id AND d.user_id = uid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Долг не найден';
    END IF;

    IF debt_row.status = 'writtenOff' THEN
        RAISE EXCEPTION 'Долг списан';
    END IF;

    IF normalized_type = 'repayment' AND debt_row.status = 'settled' THEN
        RAISE EXCEPTION 'Долг уже погашен';
    END IF;

    SELECT * INTO contact_row FROM public.contacts WHERE id = debt_row.contact_id;

    IF normalized_type = 'increase' THEN
        UPDATE public.debts
        SET amount = amount + add_debt_payment.amount,
            status = CASE
                WHEN due_date IS NOT NULL AND due_date < NOW() THEN 'overdue'
                ELSE 'active'
            END,
            settled_date = NULL,
            updated_at = NOW()
        WHERE id = add_debt_payment.debt_id
        RETURNING * INTO debt_row;
    END IF;

    INSERT INTO public.debt_payments (debt_id, amount, date, note, entry_type)
    VALUES (
        add_debt_payment.debt_id,
        add_debt_payment.amount,
        add_debt_payment.date,
        add_debt_payment.note,
        normalized_type
    )
    RETURNING * INTO payment_row;

    tx_account_id := COALESCE(add_debt_payment.payment_account_id, debt_row.account_id);

    IF add_debt_payment.create_transaction THEN
        tx_id := public.create_debt_entry_transaction(
            debt_row,
            contact_row.name,
            add_debt_payment.amount,
            normalized_type,
            add_debt_payment.date,
            add_debt_payment.note,
            tx_account_id
        );

        IF tx_id IS NOT NULL THEN
            UPDATE public.debt_payments SET transaction_id = tx_id WHERE id = payment_row.id;
            payment_row.transaction_id := tx_id;
        END IF;
    END IF;

    SELECT COALESCE(SUM(dp.amount), 0) INTO paid_amount
    FROM public.debt_payments dp
    WHERE dp.debt_id = add_debt_payment.debt_id AND dp.entry_type = 'repayment';

    new_remaining := debt_row.amount - paid_amount;

    IF normalized_type = 'repayment' THEN
        PERFORM public.recalculate_debt_status(add_debt_payment.debt_id);
    END IF;

    RETURN jsonb_build_object(
        'payment', to_jsonb(payment_row),
        'remainingAmount', new_remaining,
        'isFullyPaid', new_remaining <= 0
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_debt_payment(
    payment_id UUID,
    amount DECIMAL,
    date TIMESTAMPTZ,
    note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    payment_row public.debt_payments%ROWTYPE;
    debt_row public.debts%ROWTYPE;
    amount_delta DECIMAL;
BEGIN
    IF amount IS NULL OR amount <= 0 THEN
        RAISE EXCEPTION 'Сумма должна быть больше 0';
    END IF;

    SELECT dp.* INTO payment_row
    FROM public.debt_payments dp
    JOIN public.debts d ON d.id = dp.debt_id
    WHERE dp.id = payment_id AND d.user_id = uid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Операция не найдена';
    END IF;

    SELECT * INTO debt_row FROM public.debts WHERE id = payment_row.debt_id;

    amount_delta := amount - payment_row.amount;

    IF payment_row.entry_type = 'increase' THEN
        UPDATE public.debts
        SET amount = amount + amount_delta,
            updated_at = NOW()
        WHERE id = payment_row.debt_id
        RETURNING * INTO debt_row;
    END IF;

    UPDATE public.debt_payments
    SET amount = update_debt_payment.amount,
        date = update_debt_payment.date,
        note = update_debt_payment.note,
        updated_at = NOW()
    WHERE id = payment_id
    RETURNING * INTO payment_row;

    IF payment_row.transaction_id IS NOT NULL THEN
        UPDATE public.transactions
        SET amount = CASE
                WHEN payment_row.entry_type = 'repayment' THEN
                    CASE WHEN debt_row.type = 'iOwe' THEN -payment_row.amount ELSE payment_row.amount END
                ELSE
                    CASE WHEN debt_row.type = 'iOwe' THEN payment_row.amount ELSE -payment_row.amount END
            END,
            date = payment_row.date,
            note = CASE
                WHEN payment_row.entry_type = 'repayment' THEN 'Платеж по долгу: '
                ELSE 'Увеличение долга: '
            END || (SELECT name FROM public.contacts WHERE id = debt_row.contact_id) ||
                CASE WHEN payment_row.note IS NOT NULL AND payment_row.note <> '' THEN ': ' || payment_row.note ELSE '' END,
            updated_at = NOW()
        WHERE id = payment_row.transaction_id;
    END IF;

    PERFORM public.recalculate_debt_status(payment_row.debt_id);

    RETURN jsonb_build_object('payment', to_jsonb(payment_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_debt_payment(payment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    payment_row public.debt_payments%ROWTYPE;
    debt_id_val UUID;
BEGIN
    SELECT dp.* INTO payment_row
    FROM public.debt_payments dp
    JOIN public.debts d ON d.id = dp.debt_id
    WHERE dp.id = payment_id AND d.user_id = uid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Операция не найдена';
    END IF;

    debt_id_val := payment_row.debt_id;

    IF payment_row.transaction_id IS NOT NULL THEN
        DELETE FROM public.transactions WHERE id = payment_row.transaction_id;
    END IF;

    IF payment_row.entry_type = 'increase' THEN
        UPDATE public.debts
        SET amount = GREATEST(0, amount - payment_row.amount),
            updated_at = NOW()
        WHERE id = debt_id_val;
    END IF;

    DELETE FROM public.debt_payments WHERE id = payment_id;

    PERFORM public.recalculate_debt_status(debt_id_val);

    RETURN jsonb_build_object('debtId', debt_id_val);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_debt_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_debt_entry_transaction(public.debts, TEXT, DECIMAL, TEXT, TIMESTAMPTZ, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_debt_payment(UUID, DECIMAL, TIMESTAMPTZ, TEXT, BOOLEAN, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_debt_payment(UUID, DECIMAL, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_debt_payment(UUID) TO authenticated;
