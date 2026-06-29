-- Первоначальный займ как запись в истории долга (entry_type = initial)

ALTER TABLE public.debt_payments
    DROP CONSTRAINT IF EXISTS debt_payments_entry_type_check;

ALTER TABLE public.debt_payments
    ADD CONSTRAINT debt_payments_entry_type_check
        CHECK (entry_type IN ('repayment', 'increase', 'initial'));

COMMENT ON COLUMN public.debt_payments.entry_type IS 'repayment — погашение, increase — увеличение, initial — первоначальный займ';

-- Записи первоначального займа для существующих долгов
INSERT INTO public.debt_payments (debt_id, amount, date, note, entry_type)
SELECT
    d.id,
    d.amount - COALESCE((
        SELECT SUM(dp.amount)
        FROM public.debt_payments dp
        WHERE dp.debt_id = d.id AND dp.entry_type = 'increase'
    ), 0),
    d.date_taken,
    d.purpose,
    'initial'
FROM public.debts d
WHERE NOT EXISTS (
    SELECT 1 FROM public.debt_payments dp
    WHERE dp.debt_id = d.id AND dp.entry_type = 'initial'
);

-- Привязка транзакции создания долга к записи initial (эвристика по дате и контакту)
UPDATE public.debt_payments dp
SET transaction_id = sub.tx_id
FROM (
    SELECT
        dp2.id AS payment_id,
        (
            SELECT t.id
            FROM public.transactions t
            INNER JOIN public.debts d ON d.id = dp2.debt_id
            INNER JOIN public.contacts c ON c.id = d.contact_id
            WHERE t.user_id = d.user_id
              AND 'debt' = ANY(t.tags)
              AND NOT ('payment' = ANY(t.tags))
              AND NOT ('repayment' = ANY(t.tags))
              AND NOT ('increase' = ANY(t.tags))
              AND t.note LIKE '%' || c.name || '%'
              AND abs(EXTRACT(EPOCH FROM (t.date - dp2.date))) < 86400
            ORDER BY t.created_at ASC
            LIMIT 1
        ) AS tx_id
    FROM public.debt_payments dp2
    WHERE dp2.entry_type = 'initial'
      AND dp2.transaction_id IS NULL
) sub
WHERE dp.id = sub.payment_id
  AND sub.tx_id IS NOT NULL;

-- Создание долга: initial-запись в истории, increase при дополнении существующего
CREATE OR REPLACE FUNCTION public.create_debt(
    contact_id UUID,
    account_id UUID DEFAULT NULL,
    amount DECIMAL DEFAULT 0,
    currency TEXT DEFAULT 'KZT',
    type TEXT DEFAULT 'iOwe',
    date_taken TIMESTAMPTZ DEFAULT NOW(),
    due_date TIMESTAMPTZ DEFAULT NULL,
    purpose TEXT DEFAULT NULL,
    interest_rate REAL DEFAULT NULL,
    is_in_budget BOOLEAN DEFAULT TRUE,
    reminder_days INTEGER DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    contact_row public.contacts%ROWTYPE;
    existing_debt public.debts%ROWTYPE;
    debt_row public.debts%ROWTYPE;
    payment_row public.debt_payments%ROWTYPE;
    category_id UUID;
    category_name TEXT;
    tx_amount DECIMAL;
    action_label TEXT;
    contact_name TEXT;
    tx_id UUID;
    entry_kind TEXT;
BEGIN
    SELECT * INTO contact_row FROM public.contacts
    WHERE id = create_debt.contact_id AND user_id = uid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Контакт не найден';
    END IF;

    IF create_debt.account_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.id = create_debt.account_id AND a.user_id = uid
    ) THEN
        RAISE EXCEPTION 'Счет не найден';
    END IF;

    IF create_debt.due_date IS NOT NULL AND create_debt.due_date < create_debt.date_taken THEN
        RAISE EXCEPTION 'Дата возврата должна быть позже даты взятия долга';
    END IF;

    IF create_debt.amount IS NULL OR create_debt.amount <= 0 THEN
        RAISE EXCEPTION 'Сумма должна быть больше 0';
    END IF;

    contact_name := contact_row.name;

    SELECT * INTO existing_debt FROM public.debts d
    WHERE d.user_id = uid
      AND d.contact_id = create_debt.contact_id
      AND d.type = create_debt.type
      AND d.status IN ('active', 'overdue')
    LIMIT 1;

    IF FOUND THEN
        UPDATE public.debts d
        SET amount = d.amount + create_debt.amount,
            account_id = COALESCE(create_debt.account_id, d.account_id),
            due_date = COALESCE(create_debt.due_date, d.due_date),
            purpose = COALESCE(create_debt.purpose, d.purpose),
            status = 'active',
            updated_at = NOW()
        WHERE d.id = existing_debt.id
        RETURNING * INTO debt_row;

        entry_kind := 'increase';
        action_label := CASE WHEN create_debt.type = 'iOwe'
            THEN 'Дополнительно взял в долг' ELSE 'Дополнительно дал в долг' END;

        INSERT INTO public.debt_payments (debt_id, amount, date, note, entry_type)
        VALUES (
            debt_row.id,
            create_debt.amount,
            create_debt.date_taken,
            create_debt.purpose,
            'increase'
        )
        RETURNING * INTO payment_row;
    ELSE
        INSERT INTO public.debts (
            user_id, contact_id, account_id, amount, currency, type,
            date_taken, due_date, purpose, interest_rate, is_in_budget, reminder_days, status
        )
        VALUES (
            uid, create_debt.contact_id, create_debt.account_id, create_debt.amount, create_debt.currency,
            create_debt.type, create_debt.date_taken, create_debt.due_date, create_debt.purpose,
            create_debt.interest_rate, create_debt.is_in_budget, create_debt.reminder_days, 'active'
        )
        RETURNING * INTO debt_row;

        entry_kind := 'initial';
        action_label := CASE WHEN create_debt.type = 'iOwe'
            THEN 'Взял в долг' ELSE 'Дал в долг' END;

        INSERT INTO public.debt_payments (debt_id, amount, date, note, entry_type)
        VALUES (
            debt_row.id,
            create_debt.amount,
            create_debt.date_taken,
            create_debt.purpose,
            'initial'
        )
        RETURNING * INTO payment_row;
    END IF;

    IF create_debt.is_in_budget AND create_debt.account_id IS NOT NULL THEN
        IF entry_kind = 'initial' THEN
            category_name := CASE WHEN create_debt.type = 'iOwe' THEN 'Возврат долгов' ELSE 'Долги' END;

            SELECT c.id INTO category_id FROM public.categories c
            WHERE c.user_id = uid AND c.name = category_name AND c.is_system = TRUE
            LIMIT 1;

            IF category_id IS NOT NULL THEN
                tx_amount := CASE WHEN create_debt.type = 'iOwe' THEN create_debt.amount ELSE -create_debt.amount END;

                INSERT INTO public.transactions (user_id, account_id, category_id, amount, date, note, tags)
                VALUES (
                    uid,
                    create_debt.account_id,
                    category_id,
                    tx_amount,
                    create_debt.date_taken,
                    action_label || ' у ' || contact_name ||
                        CASE WHEN create_debt.purpose IS NOT NULL THEN ': ' || create_debt.purpose ELSE '' END,
                    ARRAY['debt', 'initial']
                )
                RETURNING id INTO tx_id;

                UPDATE public.debt_payments SET transaction_id = tx_id WHERE id = payment_row.id;
            END IF;
        ELSE
            tx_id := public.create_debt_entry_transaction(
                debt_row,
                contact_name,
                create_debt.amount,
                'increase',
                create_debt.date_taken,
                create_debt.purpose,
                create_debt.account_id
            );

            IF tx_id IS NOT NULL THEN
                UPDATE public.debt_payments SET transaction_id = tx_id WHERE id = payment_row.id;
            END IF;
        END IF;
    END IF;

    RETURN to_jsonb(debt_row);
END;
$$;

-- Редактирование операций, включая первоначальный займ
DROP FUNCTION IF EXISTS public.update_debt_payment(UUID, DECIMAL, TIMESTAMPTZ, TEXT, UUID);

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
    tx_id UUID;
    category_id UUID;
    category_name TEXT;
    tx_amount DECIMAL;
    action_label TEXT;
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

    IF payment_row.entry_type = 'initial' THEN
        UPDATE public.debts d
        SET amount = d.amount + amount_delta,
            date_taken = update_debt_payment.date,
            purpose = update_debt_payment.note,
            account_id = COALESCE(update_debt_payment.payment_account_id, d.account_id),
            updated_at = NOW()
        WHERE d.id = payment_row.debt_id
        RETURNING * INTO debt_row;
    ELSIF payment_row.entry_type = 'increase' THEN
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

    SELECT c.name INTO contact_name FROM public.contacts c WHERE c.id = debt_row.contact_id;

    IF payment_account_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.id = payment_account_id AND a.user_id = uid AND NOT a.is_archived
    ) THEN
        RAISE EXCEPTION 'Счёт не найден или недоступен';
    END IF;

    IF payment_row.transaction_id IS NOT NULL THEN
        UPDATE public.transactions t
        SET amount = CASE
                WHEN payment_row.entry_type = 'repayment' THEN
                    CASE WHEN debt_row.type = 'iOwe' THEN -payment_row.amount ELSE payment_row.amount END
                WHEN payment_row.entry_type = 'initial' THEN
                    CASE WHEN debt_row.type = 'iOwe' THEN payment_row.amount ELSE -payment_row.amount END
                ELSE
                    CASE WHEN debt_row.type = 'iOwe' THEN payment_row.amount ELSE -payment_row.amount END
            END,
            date = payment_row.date,
            note = CASE
                WHEN payment_row.entry_type = 'repayment' THEN 'Платеж по долгу: '
                WHEN payment_row.entry_type = 'initial' THEN
                    CASE WHEN debt_row.type = 'iOwe' THEN 'Взял в долг у ' ELSE 'Дал в долг ' END
                ELSE 'Увеличение долга: '
            END || contact_name ||
                CASE WHEN payment_row.note IS NOT NULL AND payment_row.note <> '' THEN ': ' || payment_row.note ELSE '' END,
            account_id = COALESCE(payment_account_id, t.account_id),
            updated_at = NOW()
        WHERE t.id = payment_row.transaction_id;
    ELSIF payment_row.entry_type = 'initial'
        AND debt_row.is_in_budget
        AND COALESCE(payment_account_id, debt_row.account_id) IS NOT NULL THEN

        category_name := CASE WHEN debt_row.type = 'iOwe' THEN 'Возврат долгов' ELSE 'Долги' END;
        action_label := CASE WHEN debt_row.type = 'iOwe' THEN 'Взял в долг' ELSE 'Дал в долг' END;

        SELECT c.id INTO category_id FROM public.categories c
        WHERE c.user_id = uid AND c.name = category_name AND c.is_system = TRUE
        LIMIT 1;

        IF category_id IS NOT NULL THEN
            tx_amount := CASE WHEN debt_row.type = 'iOwe' THEN payment_row.amount ELSE -payment_row.amount END;

            INSERT INTO public.transactions (user_id, account_id, category_id, amount, date, note, tags)
            VALUES (
                uid,
                COALESCE(payment_account_id, debt_row.account_id),
                category_id,
                tx_amount,
                payment_row.date,
                action_label || ' у ' || contact_name ||
                    CASE WHEN payment_row.note IS NOT NULL AND payment_row.note <> '' THEN ': ' || payment_row.note ELSE '' END,
                ARRAY['debt', 'initial']
            )
            RETURNING id INTO tx_id;

            UPDATE public.debt_payments SET transaction_id = tx_id WHERE id = payment_row.id;
            payment_row.transaction_id := tx_id;
        END IF;
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

    IF payment_row.entry_type = 'initial' THEN
        RAISE EXCEPTION 'Нельзя удалить первоначальный займ';
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

GRANT EXECUTE ON FUNCTION public.create_debt(UUID, UUID, DECIMAL, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, REAL, BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_debt_payment(UUID, DECIMAL, TIMESTAMPTZ, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_debt_payment(UUID) TO authenticated;
