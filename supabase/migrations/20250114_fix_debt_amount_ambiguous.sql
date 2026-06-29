-- Исправление ambiguous column "amount" при увеличении долга
-- + смена счёта при редактировании операции

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
        UPDATE public.debts d
        SET amount = d.amount + add_debt_payment.amount,
            status = CASE
                WHEN d.due_date IS NOT NULL AND d.due_date < NOW() THEN 'overdue'
                ELSE 'active'
            END,
            settled_date = NULL,
            updated_at = NOW()
        WHERE d.id = add_debt_payment.debt_id
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

DROP FUNCTION IF EXISTS public.update_debt_payment(UUID, DECIMAL, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION public.update_debt_payment(
    payment_id UUID,
    amount DECIMAL,
    date TIMESTAMPTZ,
    note TEXT DEFAULT NULL,
    payment_account_id UUID DEFAULT NULL
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
    contact_name TEXT;
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
        UPDATE public.debts d
        SET amount = d.amount + amount_delta,
            updated_at = NOW()
        WHERE d.id = payment_row.debt_id
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
        IF payment_account_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.accounts a
            WHERE a.id = payment_account_id AND a.user_id = uid AND NOT a.is_archived
        ) THEN
            RAISE EXCEPTION 'Счёт не найден или недоступен';
        END IF;

        SELECT c.name INTO contact_name FROM public.contacts c WHERE c.id = debt_row.contact_id;

        UPDATE public.transactions t
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
            END || contact_name ||
                CASE WHEN payment_row.note IS NOT NULL AND payment_row.note <> '' THEN ': ' || payment_row.note ELSE '' END,
            account_id = COALESCE(payment_account_id, t.account_id),
            updated_at = NOW()
        WHERE t.id = payment_row.transaction_id;
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
        UPDATE public.debts d
        SET amount = GREATEST(0, d.amount - payment_row.amount),
            updated_at = NOW()
        WHERE d.id = debt_id_val;
    END IF;

    DELETE FROM public.debt_payments WHERE id = payment_id;

    PERFORM public.recalculate_debt_status(debt_id_val);

    RETURN jsonb_build_object('debtId', debt_id_val);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_debt_payment(UUID, DECIMAL, TIMESTAMPTZ, TEXT, BOOLEAN, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_debt_payment(UUID, DECIMAL, TIMESTAMPTZ, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_debt_payment(UUID) TO authenticated;
