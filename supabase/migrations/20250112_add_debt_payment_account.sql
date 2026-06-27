-- Платёж по долгу: выбор счёта для транзакции (может отличаться от счёта долга)

DROP FUNCTION IF EXISTS public.add_debt_payment(UUID, DECIMAL, TIMESTAMPTZ, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.add_debt_payment(
    debt_id UUID,
    amount DECIMAL,
    date TIMESTAMPTZ DEFAULT NOW(),
    note TEXT DEFAULT NULL,
    create_transaction BOOLEAN DEFAULT TRUE,
    payment_account_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    debt_row debts%ROWTYPE;
    contact_row contacts%ROWTYPE;
    paid_amount DECIMAL;
    remaining_amount DECIMAL;
    payment_row debt_payments%ROWTYPE;
    category_id UUID;
    category_name TEXT;
    tx_amount DECIMAL;
    tx_row transactions%ROWTYPE;
    new_remaining DECIMAL;
    tx_account_id UUID;
BEGIN
    SELECT d.* INTO debt_row FROM debts d
    WHERE d.id = add_debt_payment.debt_id AND d.user_id = uid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Долг не найден';
    END IF;

    IF debt_row.status IN ('settled', 'writtenOff') THEN
        RAISE EXCEPTION 'Долг уже погашен или списан';
    END IF;

    SELECT COALESCE(SUM(dp.amount), 0) INTO paid_amount
    FROM debt_payments dp
    WHERE dp.debt_id = add_debt_payment.debt_id;

    remaining_amount := debt_row.amount - paid_amount;

    INSERT INTO debt_payments (debt_id, amount, date, note)
    VALUES (
        add_debt_payment.debt_id,
        add_debt_payment.amount,
        add_debt_payment.date,
        add_debt_payment.note
    )
    RETURNING * INTO payment_row;

    tx_account_id := COALESCE(add_debt_payment.payment_account_id, debt_row.account_id);

    IF add_debt_payment.create_transaction AND tx_account_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM accounts a
            WHERE a.id = tx_account_id AND a.user_id = uid AND NOT a.is_archived
        ) THEN
            RAISE EXCEPTION 'Счёт не найден или недоступен';
        END IF;

        category_name := CASE WHEN debt_row.type = 'iOwe' THEN 'Долги' ELSE 'Возврат долгов' END;

        SELECT c.id INTO category_id FROM categories c
        WHERE c.user_id = uid AND c.name = category_name AND c.is_system = TRUE
        LIMIT 1;

        IF category_id IS NOT NULL THEN
            SELECT * INTO contact_row FROM contacts WHERE id = debt_row.contact_id;

            tx_amount := CASE WHEN debt_row.type = 'iOwe'
                THEN -add_debt_payment.amount ELSE add_debt_payment.amount END;

            INSERT INTO transactions (user_id, account_id, category_id, amount, date, note, tags)
            VALUES (
                uid, tx_account_id, category_id, tx_amount, add_debt_payment.date,
                'Платеж по долгу: ' || contact_row.name ||
                CASE WHEN add_debt_payment.note IS NOT NULL THEN ': ' || add_debt_payment.note ELSE '' END,
                ARRAY['debt', 'payment']
            )
            RETURNING * INTO tx_row;

            UPDATE debt_payments SET transaction_id = tx_row.id WHERE id = payment_row.id;
        END IF;
    END IF;

    new_remaining := remaining_amount - add_debt_payment.amount;

    IF new_remaining <= 0 THEN
        UPDATE debts SET status = 'settled', settled_date = NOW()
        WHERE id = add_debt_payment.debt_id;
    END IF;

    RETURN jsonb_build_object(
        'payment', to_jsonb(payment_row),
        'remainingAmount', new_remaining,
        'isFullyPaid', new_remaining <= 0
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_debt_payment(UUID, DECIMAL, TIMESTAMPTZ, TEXT, BOOLEAN, UUID) TO authenticated;
