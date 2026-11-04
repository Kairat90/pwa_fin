-- Спринт A: бэкап не стирает базу, долги не смешивают валюты,
-- баланс не учитывает чужие проводки, RPC категорий закрыты от anon.
-- Сначала прогнать на копии базы. Функции SECURITY DEFINER, правки видят строки всех пользователей.

-- =====================================================
-- Кто может писать категории
-- Пустой JWT — триггер регистрации и SQL-редактор.
-- anon и чужой user_id — отказ, даже если EXECUTE когда-нибудь вернут.
-- =====================================================

CREATE OR REPLACE FUNCTION public.assert_category_write_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    jwt_role TEXT := COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '');
    claims TEXT := NULLIF(current_setting('request.jwt.claims', true), '');
BEGIN
    IF jwt_role = '' AND claims IS NOT NULL THEN
        BEGIN
            jwt_role := COALESCE(claims::jsonb ->> 'role', '');
        EXCEPTION
            WHEN OTHERS THEN
                jwt_role := '';
        END;
    END IF;

    IF jwt_role = 'anon' THEN
        RAISE EXCEPTION 'Недостаточно прав';
    END IF;

    IF jwt_role = 'authenticated' OR auth.uid() IS NOT NULL THEN
        IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'Недопустимый user_id';
        END IF;
    ELSIF jwt_role NOT IN ('', 'service_role') THEN
        RAISE EXCEPTION 'Недостаточно прав';
    END IF;

    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Пользователь не авторизован';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.backup_require_array(p_backup JSONB, p_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    value JSONB := p_backup -> p_key;
BEGIN
    IF value IS NULL OR value = 'null'::jsonb THEN
        RETURN '[]'::jsonb;
    END IF;

    IF jsonb_typeof(value) <> 'array' THEN
        RAISE EXCEPTION 'Неверный формат бэкапа: %', p_key;
    END IF;

    RETURN value;
END;
$$;

CREATE OR REPLACE FUNCTION public.backup_contains_uuid(p_rows JSONB, p_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_id IS NULL OR btrim(p_id) = '' THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_rows) AS elem
        WHERE (elem->>'id')::UUID = p_id::UUID
    );
END;
$$;

-- id из файла не должен уже принадлежать другому пользователю
CREATE OR REPLACE FUNCTION public.assert_backup_rows_owned(
    p_table TEXT,
    p_rows JSONB,
    p_uid UUID,
    p_label TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    foreign_row BOOLEAN;
BEGIN
    IF p_table NOT IN (
        'accounts', 'categories', 'contacts', 'debts',
        'transactions', 'transfers', 'scheduled_transactions'
    ) THEN
        RAISE EXCEPTION 'Неизвестная таблица бэкапа';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_rows) AS elem
        WHERE COALESCE(elem->>'id', '') = ''
    ) THEN
        RAISE EXCEPTION '% без id', p_label;
    END IF;

    EXECUTE format(
        'SELECT EXISTS (
            SELECT 1
            FROM jsonb_array_elements($1) AS elem
            JOIN public.%I AS row ON row.id = (elem->>''id'')::uuid
            WHERE row.user_id IS DISTINCT FROM $2
        )',
        p_table
    )
    INTO foreign_row
    USING p_rows, p_uid;

    IF foreign_row THEN
        RAISE EXCEPTION 'Бэкап содержит чужую запись: %', p_label;
    END IF;
EXCEPTION
    WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'В бэкапе некорректный UUID (%)', p_label;
END;
$$;

-- Пустой файл и ссылки на чужие id отклоняются до DELETE
CREATE OR REPLACE FUNCTION public.assert_backup_references(p_backup JSONB, p_uid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    accounts JSONB := public.backup_require_array(p_backup, 'accounts');
    categories JSONB := public.backup_require_array(p_backup, 'categories');
    contacts JSONB := public.backup_require_array(p_backup, 'contacts');
    debts JSONB := public.backup_require_array(p_backup, 'debts');
    transactions JSONB := public.backup_require_array(p_backup, 'transactions');
    transfers JSONB := public.backup_require_array(p_backup, 'transfers');
    scheduled JSONB := public.backup_require_array(p_backup, 'scheduled_transactions');
    payments JSONB := public.backup_require_array(p_backup, 'debt_payments');
    total INTEGER;
BEGIN
    total := jsonb_array_length(accounts) + jsonb_array_length(categories) + jsonb_array_length(contacts)
        + jsonb_array_length(debts) + jsonb_array_length(transactions) + jsonb_array_length(transfers)
        + jsonb_array_length(scheduled);

    IF total = 0 THEN
        RAISE EXCEPTION 'Бэкап не содержит данных';
    END IF;

    PERFORM public.assert_backup_rows_owned('accounts', accounts, p_uid, 'Счёт');
    PERFORM public.assert_backup_rows_owned('categories', categories, p_uid, 'Категория');
    PERFORM public.assert_backup_rows_owned('contacts', contacts, p_uid, 'Контакт');
    PERFORM public.assert_backup_rows_owned('debts', debts, p_uid, 'Долг');
    PERFORM public.assert_backup_rows_owned('transactions', transactions, p_uid, 'Операция');
    PERFORM public.assert_backup_rows_owned('transfers', transfers, p_uid, 'Перевод');
    PERFORM public.assert_backup_rows_owned('scheduled_transactions', scheduled, p_uid, 'Регулярная операция');

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(payments) AS elem
        WHERE COALESCE(elem->>'id', '') = ''
    ) THEN
        RAISE EXCEPTION 'Платёж по долгу без id';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(categories) AS elem
        WHERE COALESCE(elem->>'parent_id', '') <> ''
          AND NOT public.backup_contains_uuid(categories, elem->>'parent_id')
    ) THEN
        RAISE EXCEPTION 'Категория ссылается на родителя, которого нет в бэкапе';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(transactions) AS elem
        WHERE NOT public.backup_contains_uuid(accounts, elem->>'account_id')
    ) THEN
        RAISE EXCEPTION 'Операция ссылается на счёт, которого нет в бэкапе';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(transactions) AS elem
        WHERE COALESCE(elem->>'category_id', '') <> ''
          AND NOT public.backup_contains_uuid(categories, elem->>'category_id')
    ) THEN
        RAISE EXCEPTION 'Операция ссылается на категорию, которой нет в бэкапе';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(debts) AS elem
        WHERE NOT public.backup_contains_uuid(contacts, elem->>'contact_id')
    ) THEN
        RAISE EXCEPTION 'Долг ссылается на контакт, которого нет в бэкапе';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(debts) AS elem
        WHERE COALESCE(elem->>'account_id', '') <> ''
          AND NOT public.backup_contains_uuid(accounts, elem->>'account_id')
    ) THEN
        RAISE EXCEPTION 'Долг ссылается на счёт, которого нет в бэкапе';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(transfers) AS elem
        WHERE NOT public.backup_contains_uuid(accounts, elem->>'from_account_id')
           OR NOT public.backup_contains_uuid(accounts, elem->>'to_account_id')
    ) THEN
        RAISE EXCEPTION 'Перевод ссылается на счёт, которого нет в бэкапе';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(scheduled) AS elem
        WHERE NOT public.backup_contains_uuid(accounts, elem->>'account_id')
    ) THEN
        RAISE EXCEPTION 'Регулярная операция ссылается на счёт, которого нет в бэкапе';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(scheduled) AS elem
        WHERE COALESCE(elem->>'category_id', '') <> ''
          AND NOT public.backup_contains_uuid(categories, elem->>'category_id')
    ) THEN
        RAISE EXCEPTION 'Регулярная операция ссылается на категорию, которой нет в бэкапе';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(payments) AS elem
        WHERE NOT public.backup_contains_uuid(debts, elem->>'debt_id')
    ) THEN
        RAISE EXCEPTION 'Платёж ссылается на долг, которого нет в бэкапе';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(payments) AS elem
        WHERE COALESCE(elem->>'transaction_id', '') <> ''
          AND NOT public.backup_contains_uuid(transactions, elem->>'transaction_id')
    ) THEN
        RAISE EXCEPTION 'Платёж ссылается на операцию, которой нет в бэкапе';
    END IF;
EXCEPTION
    WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'В бэкапе некорректный UUID';
END;
$$;

-- =====================================================
-- Категории: тот же upsert, что в 20250119, плюс гард
-- =====================================================

CREATE OR REPLACE FUNCTION public.upsert_user_category(
    p_user_id UUID,
    p_name TEXT,
    p_type TEXT,
    p_parent_id UUID,
    p_sort_order INTEGER,
    p_icon TEXT DEFAULT '📁',
    p_color TEXT DEFAULT '#6B7280',
    p_is_system BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    PERFORM public.assert_category_write_user(p_user_id);

    IF p_parent_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.categories
        WHERE id = p_parent_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Родительская категория не найдена';
    END IF;

    SELECT id INTO v_id
    FROM public.categories
    WHERE user_id = p_user_id
      AND name = p_name
      AND type = p_type
      AND parent_id IS NOT DISTINCT FROM p_parent_id;

    IF v_id IS NULL THEN
        INSERT INTO public.categories (
            user_id, name, type, parent_id, sort_order, icon, color, is_system
        )
        VALUES (
            p_user_id, p_name, p_type, p_parent_id, p_sort_order, p_icon, p_color, p_is_system
        )
        RETURNING id INTO v_id;
    ELSE
        UPDATE public.categories
        SET is_system = p_is_system OR categories.is_system
        WHERE id = v_id;
    END IF;

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.init_system_categories(p_user_id UUID DEFAULT auth.uid())
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := COALESCE(p_user_id, auth.uid());
    p UUID;
BEGIN
    PERFORM public.assert_category_write_user(uid);

    PERFORM public.upsert_user_category(uid, 'Возврат долгов', 'income', NULL, 9000, '💰', '#10B981', TRUE);
    PERFORM public.upsert_user_category(uid, 'Долги', 'expense', NULL, 9000, '💳', '#EF4444', TRUE);
    PERFORM public.upsert_user_category(uid, 'Переводы', 'expense', NULL, 9001, '🔄', '#6B7280', TRUE);

    PERFORM public.upsert_user_category(uid, 'Долг', 'income', NULL, 0, '💳', '#10B981', FALSE);
    PERFORM public.upsert_user_category(uid, 'Другое', 'income', NULL, 1, '📋', '#6B7280', FALSE);
    PERFORM public.upsert_user_category(uid, 'Зарплата', 'income', NULL, 2, '💵', '#4F46E5', FALSE);
    PERFORM public.upsert_user_category(uid, 'Подарок', 'income', NULL, 3, '🎁', '#EC4899', FALSE);

    p := public.upsert_user_category(uid, 'Авто', 'expense', NULL, 0, '🚗', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Автоаксессуары/Инструмент', 'expense', p, 0, '🔧', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Налоги/Пошлины', 'expense', p, 1, '📋', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Обслуживание', 'expense', p, 2, '🛠️', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Покупка авто', 'expense', p, 3, '🚙', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Ремонт/Запчасти', 'expense', p, 4, '⚙️', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Топливо', 'expense', p, 5, '⛽', '#8B5CF6', FALSE);

    p := public.upsert_user_category(uid, 'Банк', 'expense', NULL, 1, '🏦', '#4F46E5', FALSE);
    PERFORM public.upsert_user_category(uid, 'Комиссия', 'expense', p, 0, '💳', '#4F46E5', FALSE);
    PERFORM public.upsert_user_category(uid, 'Оплата услуг банка', 'expense', p, 1, '🏧', '#4F46E5', FALSE);
    PERFORM public.upsert_user_category(uid, 'Проценты', 'expense', p, 2, '📈', '#4F46E5', FALSE);

    PERFORM public.upsert_user_category(uid, 'Гаджеты/Компьютеры', 'expense', NULL, 2, '💻', '#6366F1', FALSE);

    p := public.upsert_user_category(uid, 'Дом', 'expense', NULL, 3, '🏠', '#F59E0B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Аренда', 'expense', p, 0, '🔑', '#F59E0B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Бытовая техника', 'expense', p, 1, '📺', '#F59E0B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Инструмент', 'expense', p, 2, '🔨', '#F59E0B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Мебель', 'expense', p, 3, '🛋️', '#F59E0B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Посуда', 'expense', p, 4, '🍽️', '#F59E0B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Ремонт', 'expense', p, 5, '🧱', '#F59E0B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Электроприборы', 'expense', p, 6, '💡', '#F59E0B', FALSE);

    p := public.upsert_user_category(uid, 'Еда', 'expense', NULL, 4, '🍽️', '#EF4444', FALSE);
    PERFORM public.upsert_user_category(uid, 'Кафе', 'expense', p, 0, '☕', '#EF4444', FALSE);
    PERFORM public.upsert_user_category(uid, 'Обед', 'expense', p, 1, '🍱', '#EF4444', FALSE);
    PERFORM public.upsert_user_category(uid, 'Продукты', 'expense', p, 2, '🛒', '#EF4444', FALSE);

    p := public.upsert_user_category(uid, 'Коммунальные услуги', 'expense', NULL, 5, '💡', '#14B8A6', FALSE);
    PERFORM public.upsert_user_category(uid, 'ОСИ/КСК', 'expense', p, 0, '🏢', '#14B8A6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Электроенергия/вода/газ', 'expense', p, 1, '⚡', '#14B8A6', FALSE);

    p := public.upsert_user_category(uid, 'Красота и здоровье', 'expense', NULL, 6, '💊', '#EC4899', FALSE);
    PERFORM public.upsert_user_category(uid, 'Гигиена', 'expense', p, 0, '🧴', '#EC4899', FALSE);
    PERFORM public.upsert_user_category(uid, 'Зубы', 'expense', p, 1, '🦷', '#EC4899', FALSE);
    PERFORM public.upsert_user_category(uid, 'Лекарства', 'expense', p, 2, '💊', '#EC4899', FALSE);
    PERFORM public.upsert_user_category(uid, 'Лечение', 'expense', p, 3, '🏥', '#EC4899', FALSE);
    PERFORM public.upsert_user_category(uid, 'Массаж', 'expense', p, 4, '💆', '#EC4899', FALSE);
    PERFORM public.upsert_user_category(uid, 'Стрижка', 'expense', p, 5, '✂️', '#EC4899', FALSE);

    p := public.upsert_user_category(uid, 'Личное', 'expense', NULL, 7, '👤', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Благотворительность', 'expense', p, 0, '❤️', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Накопления/Копилка', 'expense', p, 1, '🐷', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Подарки', 'expense', p, 2, '🎁', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Подписки', 'expense', p, 3, '📱', '#8B5CF6', FALSE);

    PERFORM public.upsert_user_category(uid, 'Налоги/Пошлины', 'expense', NULL, 8, '📋', '#78716C', FALSE);

    p := public.upsert_user_category(uid, 'Одежда', 'expense', NULL, 9, '👕', '#A855F7', FALSE);
    PERFORM public.upsert_user_category(uid, 'Обувь', 'expense', p, 0, '👟', '#A855F7', FALSE);
    PERFORM public.upsert_user_category(uid, 'Одежда верхняя', 'expense', p, 1, '🧥', '#A855F7', FALSE);

    p := public.upsert_user_category(uid, 'Отдых', 'expense', NULL, 10, '🏖️', '#0EA5E9', FALSE);
    PERFORM public.upsert_user_category(uid, 'Выезд на природу', 'expense', p, 0, '🌲', '#0EA5E9', FALSE);
    PERFORM public.upsert_user_category(uid, 'Отель', 'expense', p, 1, '🏨', '#0EA5E9', FALSE);
    PERFORM public.upsert_user_category(uid, 'Рыбалка', 'expense', p, 2, '🎣', '#0EA5E9', FALSE);
    PERFORM public.upsert_user_category(uid, 'Тур', 'expense', p, 3, '✈️', '#0EA5E9', FALSE);

    p := public.upsert_user_category(uid, 'Развлечение', 'expense', NULL, 11, '🎬', '#F97316', FALSE);
    PERFORM public.upsert_user_category(uid, 'Игрушки', 'expense', p, 0, '🧸', '#F97316', FALSE);
    PERFORM public.upsert_user_category(uid, 'Кино', 'expense', p, 1, '🎬', '#F97316', FALSE);
    PERFORM public.upsert_user_category(uid, 'Книги', 'expense', p, 2, '📚', '#F97316', FALSE);
    PERFORM public.upsert_user_category(uid, 'Концерт', 'expense', p, 3, '🎵', '#F97316', FALSE);

    PERFORM public.upsert_user_category(uid, 'Семья', 'expense', NULL, 12, '👨‍👩‍👧', '#F472B6', FALSE);

    p := public.upsert_user_category(uid, 'Спорт', 'expense', NULL, 13, '🏋️', '#22C55E', FALSE);
    PERFORM public.upsert_user_category(uid, 'Бассейн', 'expense', p, 0, '🏊', '#22C55E', FALSE);
    PERFORM public.upsert_user_category(uid, 'Покупка тренажера', 'expense', p, 1, '🏋️', '#22C55E', FALSE);
    PERFORM public.upsert_user_category(uid, 'Тренажерный зал', 'expense', p, 2, '💪', '#22C55E', FALSE);

    p := public.upsert_user_category(uid, 'Транспорт', 'expense', NULL, 14, '🚌', '#3B82F6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Аренда транспорта', 'expense', p, 0, '🚐', '#3B82F6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Общественный транспорт', 'expense', p, 1, '🚇', '#3B82F6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Поезд', 'expense', p, 2, '🚆', '#3B82F6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Самолет', 'expense', p, 3, '✈️', '#3B82F6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Такси', 'expense', p, 4, '🚕', '#3B82F6', FALSE);

    p := public.upsert_user_category(uid, 'Услуги', 'expense', NULL, 15, '📞', '#64748B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Интернет(домашний/Мобильный)', 'expense', p, 0, '🌐', '#64748B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Мобильная связь', 'expense', p, 1, '📱', '#64748B', FALSE);
END;
$$;

-- Баланс только по проводкам владельца счёта. Чужой user_id на том же account_id не входит в сумму.
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
            FROM public.transactions t
            WHERE t.account_id = a.id
              AND t.user_id = uid
        ), 0)
    ), 0)
    INTO total
    FROM public.accounts a
    WHERE a.user_id = uid
      AND a.is_archived = FALSE;

    RETURN total;
END;
$$;

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
        SELECT SUM(t.amount)
        FROM public.transactions t
        WHERE t.account_id = a.id
          AND t.user_id = uid
    ), 0)
    INTO result
    FROM public.accounts a
    WHERE a.id = p_account_id
      AND a.user_id = uid;

    RETURN COALESCE(result, 0);
END;
$$;

-- Слияние долга только в той же валюте. Уже смешанные строки эта миграция не разрезает.
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
      AND upper(btrim(COALESCE(d.currency, ''))) = upper(btrim(COALESCE(create_debt.currency, '')))
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

-- Восстановление: проверка формата и владельцев до удаления.
CREATE OR REPLACE FUNCTION public.restore_user_backup(p_backup JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    row_data JSONB;
    v_tags TEXT[];
    v_avatar BYTEA;
    v_has_sort_order BOOLEAN;
    v_debt_id UUID;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Пользователь не авторизован';
    END IF;

    IF p_backup IS NULL OR jsonb_typeof(p_backup) <> 'object' THEN
        RAISE EXCEPTION 'Неверный формат бэкапа';
    END IF;

    IF COALESCE(p_backup->>'version', '') NOT IN ('1.0', '1.0.0') THEN
        RAISE EXCEPTION 'Неподдерживаемая версия бэкапа';
    END IF;

    IF COALESCE(btrim(p_backup->>'exportedAt'), '') = '' THEN
        RAISE EXCEPTION 'В бэкапе нет даты экспорта';
    END IF;

    BEGIN
        IF (p_backup->>'exportedAt')::TIMESTAMPTZ IS NULL THEN
            RAISE EXCEPTION 'Некорректная дата экспорта';
        END IF;
    EXCEPTION
        WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation THEN
            RAISE EXCEPTION 'Некорректная дата экспорта';
    END;

    PERFORM public.assert_backup_references(p_backup, uid);

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'categories'
          AND column_name = 'sort_order'
    ) INTO v_has_sort_order;

    DELETE FROM public.debt_payments
    WHERE debt_id IN (SELECT id FROM public.debts WHERE user_id = uid);

    DELETE FROM public.debts WHERE user_id = uid;
    DELETE FROM public.scheduled_transactions WHERE user_id = uid;
    DELETE FROM public.transfers WHERE user_id = uid;
    DELETE FROM public.transactions WHERE user_id = uid;
    DELETE FROM public.categories WHERE user_id = uid;
    DELETE FROM public.contacts WHERE user_id = uid;
    DELETE FROM public.accounts WHERE user_id = uid;

    FOR row_data IN
        SELECT * FROM jsonb_array_elements(COALESCE(p_backup->'accounts', '[]'::jsonb))
    LOOP
        INSERT INTO public.accounts (
            id, user_id, name, currency, initial_balance, icon, color, type, is_archived, created_at, updated_at
        )
        VALUES (
            (row_data->>'id')::UUID,
            uid,
            row_data->>'name',
            COALESCE(row_data->>'currency', 'KZT'),
            COALESCE((row_data->>'initial_balance')::DECIMAL, 0),
            row_data->>'icon',
            row_data->>'color',
            NULLIF(row_data->>'type', ''),
            COALESCE((row_data->>'is_archived')::BOOLEAN, FALSE),
            COALESCE((row_data->>'created_at')::TIMESTAMPTZ, NOW()),
            COALESCE((row_data->>'updated_at')::TIMESTAMPTZ, NOW())
        );
    END LOOP;

    FOR row_data IN
        SELECT * FROM jsonb_array_elements(COALESCE(p_backup->'categories', '[]'::jsonb))
    LOOP
        IF v_has_sort_order THEN
            INSERT INTO public.categories (
                id, user_id, name, icon, color, type, parent_id, is_system, sort_order, created_at, updated_at
            )
            VALUES (
                (row_data->>'id')::UUID,
                uid,
                row_data->>'name',
                row_data->>'icon',
                row_data->>'color',
                row_data->>'type',
                NULL,
                COALESCE((row_data->>'is_system')::BOOLEAN, FALSE),
                COALESCE((row_data->>'sort_order')::INTEGER, 0),
                COALESCE((row_data->>'created_at')::TIMESTAMPTZ, NOW()),
                COALESCE((row_data->>'updated_at')::TIMESTAMPTZ, NOW())
            );
        ELSE
            INSERT INTO public.categories (
                id, user_id, name, icon, color, type, parent_id, is_system, created_at, updated_at
            )
            VALUES (
                (row_data->>'id')::UUID,
                uid,
                row_data->>'name',
                row_data->>'icon',
                row_data->>'color',
                row_data->>'type',
                NULL,
                COALESCE((row_data->>'is_system')::BOOLEAN, FALSE),
                COALESCE((row_data->>'created_at')::TIMESTAMPTZ, NOW()),
                COALESCE((row_data->>'updated_at')::TIMESTAMPTZ, NOW())
            );
        END IF;
    END LOOP;

    FOR row_data IN
        SELECT * FROM jsonb_array_elements(COALESCE(p_backup->'categories', '[]'::jsonb))
    LOOP
        IF row_data->>'parent_id' IS NOT NULL AND row_data->>'parent_id' <> '' THEN
            UPDATE public.categories
            SET parent_id = (row_data->>'parent_id')::UUID
            WHERE id = (row_data->>'id')::UUID AND user_id = uid;
        END IF;
    END LOOP;

    FOR row_data IN
        SELECT * FROM jsonb_array_elements(COALESCE(p_backup->'contacts', '[]'::jsonb))
    LOOP
        v_avatar := NULL;

        IF row_data->'avatar_data' IS NOT NULL
           AND row_data->'avatar_data' <> 'null'::jsonb
           AND COALESCE(row_data->>'avatar_data', '') <> '' THEN
            BEGIN
                v_avatar := (row_data->>'avatar_data')::BYTEA;
            EXCEPTION WHEN OTHERS THEN
                v_avatar := NULL;
            END;
        END IF;

        INSERT INTO public.contacts (
            id, user_id, name, phone, email, note, avatar_data, is_favorite, created_at, updated_at
        )
        VALUES (
            (row_data->>'id')::UUID,
            uid,
            row_data->>'name',
            row_data->>'phone',
            row_data->>'email',
            row_data->>'note',
            v_avatar,
            COALESCE((row_data->>'is_favorite')::BOOLEAN, FALSE),
            COALESCE((row_data->>'created_at')::TIMESTAMPTZ, NOW()),
            COALESCE((row_data->>'updated_at')::TIMESTAMPTZ, NOW())
        );
    END LOOP;

    FOR row_data IN
        SELECT * FROM jsonb_array_elements(COALESCE(p_backup->'debts', '[]'::jsonb))
    LOOP
        INSERT INTO public.debts (
            id, user_id, contact_id, account_id, amount, currency, type, status,
            date_taken, due_date, settled_date, purpose, interest_rate, is_in_budget, reminder_days,
            created_at, updated_at
        )
        VALUES (
            (row_data->>'id')::UUID,
            uid,
            (row_data->>'contact_id')::UUID,
            NULLIF(row_data->>'account_id', '')::UUID,
            (row_data->>'amount')::DECIMAL,
            row_data->>'currency',
            row_data->>'type',
            COALESCE(row_data->>'status', 'active'),
            (row_data->>'date_taken')::TIMESTAMPTZ,
            NULLIF(row_data->>'due_date', '')::TIMESTAMPTZ,
            NULLIF(row_data->>'settled_date', '')::TIMESTAMPTZ,
            row_data->>'purpose',
            NULLIF(row_data->>'interest_rate', '')::REAL,
            COALESCE((row_data->>'is_in_budget')::BOOLEAN, TRUE),
            COALESCE((row_data->>'reminder_days')::INTEGER, 3),
            COALESCE((row_data->>'created_at')::TIMESTAMPTZ, NOW()),
            COALESCE((row_data->>'updated_at')::TIMESTAMPTZ, NOW())
        );
    END LOOP;

    FOR row_data IN
        SELECT * FROM jsonb_array_elements(COALESCE(p_backup->'transactions', '[]'::jsonb))
    LOOP
        v_tags := '{}'::TEXT[];

        IF row_data->'tags' IS NOT NULL
           AND row_data->'tags' <> 'null'::jsonb
           AND jsonb_typeof(row_data->'tags') = 'array' THEN
            SELECT COALESCE(ARRAY_AGG(value), '{}'::TEXT[])
            INTO v_tags
            FROM jsonb_array_elements_text(row_data->'tags') AS value;
        END IF;

        INSERT INTO public.transactions (
            id, user_id, account_id, category_id, amount, date, note, tags,
            is_excluded_from_budget, is_scheduled, created_at, updated_at
        )
        VALUES (
            (row_data->>'id')::UUID,
            uid,
            (row_data->>'account_id')::UUID,
            NULLIF(row_data->>'category_id', '')::UUID,
            (row_data->>'amount')::DECIMAL,
            (row_data->>'date')::TIMESTAMPTZ,
            row_data->>'note',
            v_tags,
            COALESCE((row_data->>'is_excluded_from_budget')::BOOLEAN, FALSE),
            COALESCE((row_data->>'is_scheduled')::BOOLEAN, FALSE),
            COALESCE((row_data->>'created_at')::TIMESTAMPTZ, NOW()),
            COALESCE((row_data->>'updated_at')::TIMESTAMPTZ, NOW())
        );
    END LOOP;

    FOR row_data IN
        SELECT * FROM jsonb_array_elements(COALESCE(p_backup->'transfers', '[]'::jsonb))
    LOOP
        INSERT INTO public.transfers (
            id, user_id, from_account_id, to_account_id, amount, converted_amount, fee,
            date, note, status, created_at, updated_at
        )
        VALUES (
            (row_data->>'id')::UUID,
            uid,
            (row_data->>'from_account_id')::UUID,
            (row_data->>'to_account_id')::UUID,
            (row_data->>'amount')::DECIMAL,
            NULLIF(row_data->>'converted_amount', '')::DECIMAL,
            COALESCE((row_data->>'fee')::DECIMAL, 0),
            (row_data->>'date')::TIMESTAMPTZ,
            row_data->>'note',
            COALESCE(row_data->>'status', 'completed'),
            COALESCE((row_data->>'created_at')::TIMESTAMPTZ, NOW()),
            COALESCE((row_data->>'updated_at')::TIMESTAMPTZ, NOW())
        );
    END LOOP;

    FOR row_data IN
        SELECT * FROM jsonb_array_elements(COALESCE(p_backup->'scheduled_transactions', '[]'::jsonb))
    LOOP
        INSERT INTO public.scheduled_transactions (
            id, user_id, account_id, category_id, title, amount, type,
            start_date, end_date, frequency, custom_days, next_execution_date,
            is_active, note, last_executed_date, created_at, updated_at
        )
        VALUES (
            (row_data->>'id')::UUID,
            uid,
            (row_data->>'account_id')::UUID,
            NULLIF(row_data->>'category_id', '')::UUID,
            row_data->>'title',
            (row_data->>'amount')::DECIMAL,
            row_data->>'type',
            (row_data->>'start_date')::TIMESTAMPTZ,
            NULLIF(row_data->>'end_date', '')::TIMESTAMPTZ,
            row_data->>'frequency',
            NULLIF(row_data->>'custom_days', '')::INTEGER,
            (row_data->>'next_execution_date')::TIMESTAMPTZ,
            COALESCE((row_data->>'is_active')::BOOLEAN, TRUE),
            row_data->>'note',
            NULLIF(row_data->>'last_executed_date', '')::TIMESTAMPTZ,
            COALESCE((row_data->>'created_at')::TIMESTAMPTZ, NOW()),
            COALESCE((row_data->>'updated_at')::TIMESTAMPTZ, NOW())
        );
    END LOOP;

    FOR row_data IN
        SELECT * FROM jsonb_array_elements(COALESCE(p_backup->'debt_payments', '[]'::jsonb))
    LOOP
        v_debt_id := (row_data->>'debt_id')::UUID;

        IF NOT EXISTS (
            SELECT 1 FROM public.debts
            WHERE id = v_debt_id AND user_id = uid
        ) THEN
            RAISE EXCEPTION 'Платёж ссылается на чужой или несуществующий долг: %', v_debt_id;
        END IF;

        INSERT INTO public.debt_payments (
            id, debt_id, amount, date, note, transaction_id, entry_type, created_at, updated_at
        )
        VALUES (
            (row_data->>'id')::UUID,
            v_debt_id,
            (row_data->>'amount')::DECIMAL,
            (row_data->>'date')::TIMESTAMPTZ,
            row_data->>'note',
            NULLIF(row_data->>'transaction_id', '')::UUID,
            COALESCE(NULLIF(row_data->>'entry_type', ''), 'repayment'),
            COALESCE((row_data->>'created_at')::TIMESTAMPTZ, NOW()),
            COALESCE((row_data->>'updated_at')::TIMESTAMPTZ, NOW())
        );
    END LOOP;
END;
$$;

-- EXECUTE с публичной роли и anon снимается. authenticated остаётся.
DO $$
DECLARE
    fn TEXT;
    fns TEXT[] := ARRAY[
        'public.assert_category_write_user(uuid)',
        'public.backup_require_array(jsonb, text)',
        'public.backup_contains_uuid(jsonb, text)',
        'public.assert_backup_rows_owned(text, jsonb, uuid, text)',
        'public.assert_backup_references(jsonb, uuid)',
        'public.init_system_categories(uuid)',
        'public.upsert_user_category(uuid, text, text, uuid, integer, text, text, boolean)',
        'public.reorder_category(uuid, text)',
        'public.restore_user_backup(jsonb)',
        'public.get_total_balance()',
        'public.get_account_balance(uuid)',
        'public.create_debt(uuid, uuid, numeric, text, text, timestamp with time zone, timestamp with time zone, text, real, boolean, integer)'
    ];
BEGIN
    FOREACH fn IN ARRAY fns LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);

        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
        END IF;
    END LOOP;
END;
$$;

-- Владелец функций должен вызывать внутренние проверки из SECURITY DEFINER
DO $$
DECLARE
    helper TEXT;
    helpers TEXT[] := ARRAY[
        'public.assert_category_write_user(uuid)',
        'public.backup_require_array(jsonb, text)',
        'public.backup_contains_uuid(jsonb, text)',
        'public.assert_backup_rows_owned(text, jsonb, uuid, text)',
        'public.assert_backup_references(jsonb, uuid)'
    ];
BEGIN
    FOREACH helper IN ARRAY helpers LOOP
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', helper, current_user);
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.init_system_categories(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_user_category(UUID, TEXT, TEXT, UUID, INTEGER, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_category(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_user_backup(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_total_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_debt(UUID, UUID, DECIMAL, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, REAL, BOOLEAN, INTEGER) TO authenticated;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.init_system_categories(UUID) TO service_role;
        GRANT EXECUTE ON FUNCTION public.upsert_user_category(UUID, TEXT, TEXT, UUID, INTEGER, TEXT, TEXT, BOOLEAN) TO service_role;
        GRANT EXECUTE ON FUNCTION public.assert_category_write_user(UUID) TO service_role;
    END IF;
END;
$$;
