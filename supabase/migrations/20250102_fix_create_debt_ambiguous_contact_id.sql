-- Исправление: column reference "contact_id" is ambiguous в create_debt
-- Параметр функции совпадал с именем колонки debts.contact_id

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
    contact_row contacts%ROWTYPE;
    existing_debt debts%ROWTYPE;
    debt_row debts%ROWTYPE;
    category_id UUID;
    category_name TEXT;
    tx_amount DECIMAL;
    action_label TEXT;
    contact_name TEXT;
BEGIN
    SELECT * INTO contact_row FROM contacts WHERE id = create_debt.contact_id AND user_id = uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Контакт не найден';
    END IF;

    IF create_debt.account_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM accounts WHERE id = create_debt.account_id AND user_id = uid
    ) THEN
        RAISE EXCEPTION 'Счет не найден';
    END IF;

    IF create_debt.due_date IS NOT NULL AND create_debt.due_date < create_debt.date_taken THEN
        RAISE EXCEPTION 'Дата возврата должна быть позже даты взятия долга';
    END IF;

    SELECT * INTO existing_debt FROM debts d
    WHERE d.user_id = uid
    AND d.contact_id = create_debt.contact_id
    AND d.type = create_debt.type
    AND d.status IN ('active', 'overdue')
    LIMIT 1;

    IF FOUND THEN
        UPDATE debts
        SET amount = existing_debt.amount + create_debt.amount,
            account_id = COALESCE(create_debt.account_id, existing_debt.account_id),
            due_date = COALESCE(create_debt.due_date, existing_debt.due_date),
            purpose = COALESCE(create_debt.purpose, existing_debt.purpose),
            status = 'active'
        WHERE id = existing_debt.id
        RETURNING * INTO debt_row;

        action_label := CASE WHEN create_debt.type = 'iOwe'
            THEN 'Дополнительно взял в долг' ELSE 'Дополнительно дал в долг' END;
    ELSE
        INSERT INTO debts (
            user_id, contact_id, account_id, amount, currency, type,
            date_taken, due_date, purpose, interest_rate, is_in_budget, reminder_days, status
        )
        VALUES (
            uid, create_debt.contact_id, create_debt.account_id, create_debt.amount, create_debt.currency, create_debt.type,
            create_debt.date_taken, create_debt.due_date, create_debt.purpose, create_debt.interest_rate,
            create_debt.is_in_budget, create_debt.reminder_days, 'active'
        )
        RETURNING * INTO debt_row;

        action_label := CASE WHEN create_debt.type = 'iOwe'
            THEN 'Взял в долг' ELSE 'Дал в долг' END;
    END IF;

    IF create_debt.is_in_budget AND create_debt.account_id IS NOT NULL THEN
        category_name := CASE WHEN create_debt.type = 'iOwe' THEN 'Возврат долгов' ELSE 'Долги' END;

        SELECT id INTO category_id FROM categories
        WHERE user_id = uid AND name = category_name AND is_system = TRUE
        LIMIT 1;

        IF category_id IS NOT NULL THEN
            tx_amount := CASE WHEN create_debt.type = 'iOwe' THEN create_debt.amount ELSE -create_debt.amount END;
            contact_name := contact_row.name;

            INSERT INTO transactions (user_id, account_id, category_id, amount, date, note, tags)
            VALUES (
                uid, create_debt.account_id, category_id, tx_amount, create_debt.date_taken,
                action_label || ' у ' || contact_name ||
                CASE WHEN create_debt.purpose IS NOT NULL THEN ': ' || create_debt.purpose ELSE '' END,
                ARRAY['debt']
            );
        END IF;
    END IF;

    RETURN to_jsonb(debt_row);
END;
$$;
