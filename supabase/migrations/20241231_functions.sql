-- =====================================================
-- SQL-функции для бизнес-логики (замена Node.js backend)
-- =====================================================

-- =====================================================
-- Инициализация системных категорий
-- =====================================================
CREATE OR REPLACE FUNCTION public.init_system_categories(p_user_id UUID DEFAULT auth.uid())
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cat RECORD;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Пользователь не авторизован';
    END IF;

    FOR cat IN
        SELECT * FROM (VALUES
            ('Долги', 'expense', '💳', TRUE, '#EF4444'),
            ('Возврат долгов', 'income', '💰', TRUE, '#EF4444'),
            ('Переводы', 'expense', '🔄', TRUE, '#EF4444'),
            ('Зарплата', 'income', '💵', FALSE, '#6B7280'),
            ('Продукты', 'expense', '🛒', FALSE, '#6B7280'),
            ('Транспорт', 'expense', '🚗', FALSE, '#6B7280'),
            ('Развлечения', 'expense', '🎬', FALSE, '#6B7280'),
            ('Здоровье', 'expense', '🏥', FALSE, '#6B7280'),
            ('Образование', 'expense', '📚', FALSE, '#6B7280')
        ) AS t(name, type, icon, is_system, color)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM categories
            WHERE user_id = p_user_id
            AND name = cat.name
            AND is_system = cat.is_system
        ) THEN
            INSERT INTO categories (user_id, name, type, icon, color, is_system)
            VALUES (p_user_id, cat.name, cat.type, cat.icon, cat.color, cat.is_system);
        END IF;
    END LOOP;
END;
$$;

-- =====================================================
-- Общий баланс по всем счетам
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_total_balance()
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total DECIMAL := 0;
    uid UUID := auth.uid();
BEGIN
    SELECT COALESCE(SUM(
        a.initial_balance + COALESCE((
            SELECT SUM(t.amount)
            FROM transactions t
            WHERE t.account_id = a.id
        ), 0)
    ), 0)
    INTO total
    FROM accounts a
    WHERE a.user_id = uid
    AND a.is_archived = FALSE;

    RETURN total;
END;
$$;

-- =====================================================
-- Баланс одного счёта
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_account_balance(p_account_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result DECIMAL;
    uid UUID := auth.uid();
BEGIN
    SELECT a.initial_balance + COALESCE((
        SELECT SUM(t.amount) FROM transactions t WHERE t.account_id = a.id
    ), 0)
    INTO result
    FROM accounts a
    WHERE a.id = p_account_id AND a.user_id = uid;

    RETURN COALESCE(result, 0);
END;
$$;

-- =====================================================
-- Создание перевода
-- =====================================================
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
    current_balance DECIMAL;
    transfer_row transfers%ROWTYPE;
    transfer_category_id UUID;
    transfer_note TEXT;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Пользователь не авторизован';
    END IF;

    IF from_account_id = to_account_id THEN
        RAISE EXCEPTION 'Нельзя переводить на тот же счет';
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
    current_balance := get_account_balance(from_account_id);

    IF current_balance < total_with_fee THEN
        RAISE EXCEPTION 'Недостаточно средств. Доступно: %', current_balance;
    END IF;

    SELECT id INTO transfer_category_id
    FROM categories
    WHERE user_id = uid AND name = 'Переводы' AND is_system = TRUE
    LIMIT 1;

    INSERT INTO transfers (user_id, from_account_id, to_account_id, amount, fee, date, note, status)
    VALUES (uid, from_account_id, to_account_id, amount, COALESCE(fee, 0), date, note, 'completed')
    RETURNING * INTO transfer_row;

    transfer_note := 'Перевод на счет "' || to_acc.name || '"';
    IF note IS NOT NULL AND note <> '' THEN
        transfer_note := transfer_note || ': ' || note;
    END IF;

    INSERT INTO transactions (user_id, account_id, category_id, amount, date, note, tags, is_excluded_from_budget)
    VALUES (uid, from_account_id, transfer_category_id, -total_with_fee, date, transfer_note, ARRAY['transfer'], TRUE);

    transfer_note := 'Перевод со счета "' || from_acc.name || '"';
    IF note IS NOT NULL AND note <> '' THEN
        transfer_note := transfer_note || ': ' || note;
    END IF;

    INSERT INTO transactions (user_id, account_id, category_id, amount, date, note, tags, is_excluded_from_budget)
    VALUES (uid, to_account_id, transfer_category_id, amount, date, transfer_note, ARRAY['transfer'], TRUE);

    RETURN to_jsonb(transfer_row);
END;
$$;

-- =====================================================
-- Расчёт следующей даты планировщика
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_next_scheduled_date(
    p_start_date TIMESTAMPTZ,
    p_frequency TEXT,
    p_custom_days INTEGER DEFAULT NULL
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
BEGIN
    CASE p_frequency
        WHEN 'daily' THEN RETURN p_start_date + INTERVAL '1 day';
        WHEN 'weekly' THEN RETURN p_start_date + INTERVAL '1 week';
        WHEN 'biweekly' THEN RETURN p_start_date + INTERVAL '2 weeks';
        WHEN 'monthly' THEN RETURN p_start_date + INTERVAL '1 month';
        WHEN 'yearly' THEN RETURN p_start_date + INTERVAL '1 year';
        WHEN 'custom' THEN
            IF p_custom_days IS NULL THEN
                RAISE EXCEPTION 'Для custom периодичности укажите custom_days';
            END IF;
            RETURN p_start_date + (p_custom_days || ' days')::INTERVAL;
        ELSE
            RAISE EXCEPTION 'Неизвестная периодичность: %', p_frequency;
    END CASE;
END;
$$;

-- =====================================================
-- Пропуск запланированной операции
-- =====================================================
CREATE OR REPLACE FUNCTION public.skip_scheduled_execution(scheduled_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    item scheduled_transactions%ROWTYPE;
    next_date TIMESTAMPTZ;
BEGIN
    SELECT * INTO item FROM scheduled_transactions
    WHERE id = scheduled_id AND user_id = uid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Запланированная операция не найдена';
    END IF;

    IF NOT item.is_active THEN
        RAISE EXCEPTION 'Операция неактивна';
    END IF;

    next_date := calculate_next_scheduled_date(item.next_execution_date, item.frequency, item.custom_days);

    IF item.end_date IS NOT NULL AND next_date > item.end_date THEN
        UPDATE scheduled_transactions
        SET is_active = FALSE, next_execution_date = next_date
        WHERE id = scheduled_id
        RETURNING * INTO item;
    ELSE
        UPDATE scheduled_transactions
        SET next_execution_date = next_date
        WHERE id = scheduled_id
        RETURNING * INTO item;
    END IF;

    RETURN to_jsonb(item);
END;
$$;

-- =====================================================
-- Выполнить запланированную операцию сейчас
-- =====================================================
CREATE OR REPLACE FUNCTION public.execute_scheduled_now(scheduled_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    item scheduled_transactions%ROWTYPE;
    tx_amount DECIMAL;
    tx_row transactions%ROWTYPE;
    next_date TIMESTAMPTZ;
    still_active BOOLEAN := TRUE;
BEGIN
    SELECT * INTO item FROM scheduled_transactions
    WHERE id = scheduled_id AND user_id = uid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Запланированная операция не найдена';
    END IF;

    IF NOT item.is_active THEN
        RAISE EXCEPTION 'Операция неактивна';
    END IF;

    tx_amount := CASE WHEN item.type = 'expense' THEN -ABS(item.amount) ELSE ABS(item.amount) END;

    INSERT INTO transactions (user_id, account_id, category_id, amount, date, note, is_scheduled)
    VALUES (
        uid, item.account_id, item.category_id, tx_amount, NOW(),
        'Запланированная операция: ' || item.title, TRUE
    )
    RETURNING * INTO tx_row;

    next_date := calculate_next_scheduled_date(item.next_execution_date, item.frequency, item.custom_days);

    IF item.end_date IS NOT NULL AND next_date > item.end_date THEN
        still_active := FALSE;
    END IF;

    UPDATE scheduled_transactions
    SET next_execution_date = next_date,
        is_active = still_active,
        last_executed_date = NOW()
    WHERE id = scheduled_id;

    RETURN jsonb_build_object('transaction', to_jsonb(tx_row));
END;
$$;

-- =====================================================
-- Обработка всех просроченных планировщиков
-- =====================================================
CREATE OR REPLACE FUNCTION public.process_scheduled_transactions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    item RECORD;
    results JSONB := '[]'::JSONB;
    tx_amount DECIMAL;
    next_date TIMESTAMPTZ;
    still_active BOOLEAN;
BEGIN
    FOR item IN
        SELECT * FROM scheduled_transactions
        WHERE user_id = uid
        AND is_active = TRUE
        AND next_execution_date <= NOW()
    LOOP
        BEGIN
            tx_amount := CASE WHEN item.type = 'expense' THEN -ABS(item.amount) ELSE ABS(item.amount) END;

            INSERT INTO transactions (user_id, account_id, category_id, amount, date, note, is_scheduled)
            VALUES (
                uid, item.account_id, item.category_id, tx_amount, item.next_execution_date,
                'Запланированная операция: ' || item.title, TRUE
            );

            next_date := calculate_next_scheduled_date(item.next_execution_date, item.frequency, item.custom_days);
            still_active := item.end_date IS NULL OR next_date <= item.end_date;

            UPDATE scheduled_transactions
            SET next_execution_date = next_date,
                is_active = still_active,
                last_executed_date = NOW()
            WHERE id = item.id;

            results := results || jsonb_build_object(
                'scheduledId', item.id,
                'title', item.title,
                'executed', TRUE
            );
        EXCEPTION WHEN OTHERS THEN
            results := results || jsonb_build_object(
                'scheduledId', item.id,
                'title', item.title,
                'executed', FALSE,
                'error', SQLERRM
            );
        END;
    END LOOP;

    RETURN results;
END;
$$;

-- =====================================================
-- Создание долга
-- =====================================================
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

-- =====================================================
-- Платёж по долгу
-- =====================================================
CREATE OR REPLACE FUNCTION public.add_debt_payment(
    debt_id UUID,
    amount DECIMAL,
    date TIMESTAMPTZ DEFAULT NOW(),
    note TEXT DEFAULT NULL,
    create_transaction BOOLEAN DEFAULT TRUE
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

    IF add_debt_payment.create_transaction AND debt_row.account_id IS NOT NULL THEN
        category_name := CASE WHEN debt_row.type = 'iOwe' THEN 'Долги' ELSE 'Возврат долгов' END;

        SELECT id INTO category_id FROM categories
        WHERE user_id = uid AND name = category_name AND is_system = TRUE
        LIMIT 1;

        IF category_id IS NOT NULL THEN
            SELECT * INTO contact_row FROM contacts WHERE id = debt_row.contact_id;

            tx_amount := CASE WHEN debt_row.type = 'iOwe'
                THEN -add_debt_payment.amount ELSE add_debt_payment.amount END;

            INSERT INTO transactions (user_id, account_id, category_id, amount, date, note, tags)
            VALUES (
                uid, debt_row.account_id, category_id, tx_amount, add_debt_payment.date,
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

-- =====================================================
-- Статистика по долгам
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_debt_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    total_i_owe DECIMAL := 0;
    total_owed_to_me DECIMAL := 0;
    overdue_count INTEGER := 0;
    active_count INTEGER := 0;
    total_debts INTEGER := 0;
    d RECORD;
    paid DECIMAL;
    remaining DECIMAL;
BEGIN
    FOR d IN
        SELECT * FROM debts
        WHERE user_id = uid AND status IN ('active', 'overdue')
    LOOP
        SELECT COALESCE(SUM(amount), 0) INTO paid FROM debt_payments WHERE debt_id = d.id;
        remaining := d.amount - paid;

        IF d.type = 'iOwe' THEN
            total_i_owe := total_i_owe + remaining;
        ELSE
            total_owed_to_me := total_owed_to_me + remaining;
        END IF;

        IF d.status = 'overdue' THEN overdue_count := overdue_count + 1; END IF;
        IF d.status = 'active' THEN active_count := active_count + 1; END IF;
        total_debts := total_debts + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'totalIOwe', total_i_owe,
        'totalOwedToMe', total_owed_to_me,
        'netPosition', total_owed_to_me - total_i_owe,
        'overdueCount', overdue_count,
        'activeCount', active_count,
        'totalDebts', total_debts
    );
END;
$$;

-- =====================================================
-- Проверка просроченных долгов
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_overdue_debts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cnt INTEGER;
BEGIN
    UPDATE debts
    SET status = 'overdue'
    WHERE user_id = auth.uid()
    AND status = 'active'
    AND due_date IS NOT NULL
    AND due_date < NOW();

    GET DIAGNOSTICS cnt = ROW_COUNT;

    RETURN jsonb_build_object('message', 'Просроченные долги обновлены', 'count', cnt);
END;
$$;

-- =====================================================
-- Сводка отчёта
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_summary(
    start_date DATE,
    end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    total_income DECIMAL := 0;
    total_expense DECIMAL := 0;
    income_count INTEGER := 0;
    expense_count INTEGER := 0;
    tx_count INTEGER := 0;
    days_in_period INTEGER;
    net_flow DECIMAL;
    savings_rate DECIMAL;
    t RECORD;
BEGIN
    FOR t IN
        SELECT amount FROM transactions
        WHERE user_id = uid
        AND is_excluded_from_budget = FALSE
        AND date >= start_date::TIMESTAMPTZ
        AND date < (end_date + INTERVAL '1 day')::TIMESTAMPTZ
    LOOP
        tx_count := tx_count + 1;
        IF t.amount > 0 THEN
            total_income := total_income + t.amount;
            income_count := income_count + 1;
        ELSE
            total_expense := total_expense + ABS(t.amount);
            expense_count := expense_count + 1;
        END IF;
    END LOOP;

    net_flow := total_income - total_expense;
    days_in_period := GREATEST(end_date - start_date + 1, 1);
    savings_rate := CASE WHEN total_income > 0 THEN (net_flow / total_income) * 100 ELSE 0 END;

    RETURN jsonb_build_object(
        'totalIncome', total_income,
        'totalExpense', total_expense,
        'netFlow', net_flow,
        'averageDailyExpense', total_expense / days_in_period,
        'transactionCount', tx_count,
        'incomeCount', income_count,
        'expenseCount', expense_count,
        'savingsRate', savings_rate
    );
END;
$$;

-- =====================================================
-- Структура по категориям
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_category_breakdown(
    start_date DATE,
    end_date DATE,
    type_param TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    result JSONB := '[]'::JSONB;
    total_amount DECIMAL := 0;
    row_data RECORD;
BEGIN
    FOR row_data IN
        SELECT
            COALESCE(c.id::TEXT, 'uncategorized') AS id,
            COALESCE(c.name, 'Без категории') AS name,
            COALESCE(c.icon, '📁') AS icon,
            COALESCE(c.color, '#6B7280') AS color,
            SUM(ABS(t.amount)) AS amount,
            COUNT(*) AS cnt
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.user_id = uid
        AND t.is_excluded_from_budget = FALSE
        AND t.date >= start_date::TIMESTAMPTZ
        AND t.date < (end_date + INTERVAL '1 day')::TIMESTAMPTZ
        AND (
            (type_param = 'income' AND t.amount > 0)
            OR (type_param = 'expense' AND t.amount < 0)
        )
        AND (c.type = type_param OR (c.id IS NULL AND type_param = 'expense'))
        GROUP BY c.id, c.name, c.icon, c.color
        ORDER BY amount DESC
    LOOP
        total_amount := total_amount + row_data.amount;
        result := result || jsonb_build_object(
            'id', row_data.id,
            'name', row_data.name,
            'icon', row_data.icon,
            'color', row_data.color,
            'amount', row_data.amount,
            'count', row_data.cnt,
            'percentage', 0
        );
    END LOOP;

    IF total_amount > 0 THEN
        SELECT jsonb_agg(
            elem || jsonb_build_object(
                'percentage', (elem->>'amount')::DECIMAL / total_amount * 100
            )
        )
        INTO result
        FROM jsonb_array_elements(result) AS elem;
    END IF;

    RETURN COALESCE(result, '[]'::JSONB);
END;
$$;

-- =====================================================
-- История баланса
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_balance_history(
    start_date DATE,
    end_date DATE,
    account_id_param UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    current_balance DECIMAL := 0;
    day_cursor DATE;
    day_end TIMESTAMPTZ;
    result JSONB := '[]'::JSONB;
    day_num INTEGER := 0;
    day_sum DECIMAL;
BEGIN
    SELECT COALESCE(SUM(a.initial_balance), 0) + COALESCE(SUM(t.amount), 0)
    INTO current_balance
    FROM accounts a
    LEFT JOIN transactions t ON t.account_id = a.id
        AND t.is_excluded_from_budget = FALSE
        AND t.date < start_date::TIMESTAMPTZ
    WHERE a.user_id = uid
    AND (account_id_param IS NULL OR a.id = account_id_param);

    day_cursor := start_date;

    WHILE day_cursor <= end_date LOOP
        day_num := day_num + 1;
        day_end := (day_cursor + INTERVAL '1 day')::TIMESTAMPTZ;

        SELECT COALESCE(SUM(t.amount), 0) INTO day_sum
        FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        WHERE t.user_id = uid
        AND t.is_excluded_from_budget = FALSE
        AND t.date >= day_cursor::TIMESTAMPTZ
        AND t.date < day_end
        AND (account_id_param IS NULL OR t.account_id = account_id_param);

        current_balance := current_balance + day_sum;

        result := result || jsonb_build_object(
            'date', to_char(day_cursor, 'YYYY-MM-DD'),
            'balance', current_balance,
            'day', day_num
        );

        day_cursor := day_cursor + 1;
    END LOOP;

    RETURN result;
END;
$$;

-- =====================================================
-- Топ транзакций (расходы)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_top_transactions(
    start_date DATE,
    end_date DATE,
    limit_param INTEGER DEFAULT 10
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
    SELECT COALESCE(jsonb_agg(row_to_json(q)::JSONB), '[]'::JSONB)
    INTO result
    FROM (
        SELECT
            t.id,
            ABS(t.amount) AS amount,
            t.date,
            COALESCE(t.note, 'Без описания') AS note,
            COALESCE(c.name, 'Без категории') AS category,
            COALESCE(c.icon, '📁') AS "categoryIcon",
            COALESCE(a.name, 'Без счета') AS account
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        LEFT JOIN accounts a ON a.id = t.account_id
        WHERE t.user_id = uid
        AND t.is_excluded_from_budget = FALSE
        AND t.amount < 0
        AND t.date >= start_date::TIMESTAMPTZ
        AND t.date < (end_date + INTERVAL '1 day')::TIMESTAMPTZ
        ORDER BY t.amount ASC
        LIMIT limit_param
    ) q;

    RETURN result;
END;
$$;

-- =====================================================
-- Сравнение с прошлым периодом
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_comparison(
    start_date DATE,
    end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    period_days INTEGER;
    prev_start DATE;
    prev_end DATE;
    current_summary JSONB;
    previous_summary JSONB;
    change_pct DECIMAL;
BEGIN
    period_days := end_date - start_date + 1;
    prev_end := start_date - 1;
    prev_start := prev_end - period_days + 1;

    current_summary := get_summary(start_date, end_date);
    previous_summary := get_summary(prev_start, prev_end);

    RETURN jsonb_build_object(
        'current', current_summary,
        'previous', previous_summary,
        'changes', jsonb_build_object(
            'income', CASE WHEN (previous_summary->>'totalIncome')::DECIMAL = 0 THEN 0
                ELSE ((current_summary->>'totalIncome')::DECIMAL - (previous_summary->>'totalIncome')::DECIMAL)
                    / (previous_summary->>'totalIncome')::DECIMAL * 100 END,
            'expense', CASE WHEN (previous_summary->>'totalExpense')::DECIMAL = 0 THEN 0
                ELSE ((current_summary->>'totalExpense')::DECIMAL - (previous_summary->>'totalExpense')::DECIMAL)
                    / (previous_summary->>'totalExpense')::DECIMAL * 100 END,
            'netFlow', CASE WHEN (previous_summary->>'netFlow')::DECIMAL = 0 THEN 0
                ELSE ((current_summary->>'netFlow')::DECIMAL - (previous_summary->>'netFlow')::DECIMAL)
                    / ABS((previous_summary->>'netFlow')::DECIMAL) * 100 END,
            'transactions', CASE WHEN (previous_summary->>'transactionCount')::DECIMAL = 0 THEN 0
                ELSE ((current_summary->>'transactionCount')::DECIMAL - (previous_summary->>'transactionCount')::DECIMAL)
                    / (previous_summary->>'transactionCount')::DECIMAL * 100 END
        )
    );
END;
$$;

-- =====================================================
-- Прогноз
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_forecast(days_ahead INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    total_expense DECIMAL := 0;
    total_income DECIMAL := 0;
    daily_expense DECIMAL;
    daily_income DECIMAL;
    current_balance DECIMAL;
    projected_balance DECIMAL;
    days_until_zero INTEGER;
    months_until_zero DECIMAL;
    t RECORD;
BEGIN
    FOR t IN
        SELECT amount FROM transactions
        WHERE user_id = uid
        AND is_excluded_from_budget = FALSE
        AND date >= (NOW() - INTERVAL '30 days')
    LOOP
        IF t.amount < 0 THEN
            total_expense := total_expense + ABS(t.amount);
        ELSE
            total_income := total_income + t.amount;
        END IF;
    END LOOP;

    daily_expense := total_expense / 30;
    daily_income := total_income / 30;
    current_balance := get_total_balance();
    projected_balance := current_balance - daily_expense * days_ahead + daily_income * days_ahead;

    IF daily_expense > 0 THEN
        days_until_zero := FLOOR(current_balance / daily_expense);
        months_until_zero := current_balance / (daily_expense * 30);
    ELSE
        days_until_zero := 999999;
        months_until_zero := 999999;
    END IF;

    RETURN jsonb_build_object(
        'currentBalance', current_balance,
        'dailyExpense', daily_expense,
        'dailyIncome', daily_income,
        'projectedBalance', projected_balance,
        'daysUntilZero', days_until_zero,
        'monthsUntilZero', months_until_zero
    );
END;
$$;

-- Права на вызов функций для authenticated
GRANT EXECUTE ON FUNCTION public.init_system_categories(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_total_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_transfer(UUID, UUID, DECIMAL, DECIMAL, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.skip_scheduled_execution(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_scheduled_now(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_scheduled_transactions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_debt(UUID, UUID, DECIMAL, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, REAL, BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_debt_payment(UUID, DECIMAL, TIMESTAMPTZ, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_debt_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_overdue_debts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_summary(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_category_breakdown(DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_balance_history(DATE, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_transactions(DATE, DATE, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_comparison(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_forecast(INTEGER) TO authenticated;
