-- =====================================================
-- PWA «Финансовый учёт» — SQL-функции (замена Node.js backend)
-- =====================================================
--
-- ИНСТРУКЦИЯ:
-- 1. Сначала выполните миграции схемы: 20241230_initial_schema.sql
-- 2. Затем вставьте ВЕСЬ этот файл в Supabase Dashboard → SQL Editor → Run
-- 3. Проверьте: Database → Functions (должно быть 17 функций)
--
-- ПРИМЕЧАНИЕ:
-- Сигнатуры функций согласованы с frontend/src/api/supabase.ts
-- (возвращают JSONB/DECIMAL, параметры в snake_case для supabase.rpc)
--
-- ПРОВЕРКА (под авторизованным пользователем):
--   SELECT init_system_categories();
--   SELECT get_total_balance();
--   SELECT get_debt_stats();
--   SELECT get_summary('2024-01-01'::DATE, '2024-01-31'::DATE);
-- =====================================================


-- #####################################################################
-- 0. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ RLS (миграция 20250110)
-- #####################################################################

CREATE OR REPLACE FUNCTION public.current_user_owns_account(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.accounts
        WHERE id = p_account_id AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.current_user_owns_category(p_category_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.categories
        WHERE id = p_category_id AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.current_user_owns_contact(p_contact_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.contacts
        WHERE id = p_contact_id AND user_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_owns_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_owns_category(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_owns_contact(UUID) TO authenticated;


-- #####################################################################
-- 1. БАЗОВЫЕ ФИНАНСОВЫЕ ОПЕРАЦИИ
-- #####################################################################

-- =====================================================
-- ФУНКЦИЯ: upsert_user_category (вставка/обновление категории)
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
    IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Недопустимый user_id';
    END IF;

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
        SET sort_order = p_sort_order,
            icon = COALESCE(icon, p_icon),
            color = COALESCE(color, p_color),
            is_system = p_is_system OR categories.is_system
        WHERE id = v_id;
    END IF;

    RETURN v_id;
END;
$$;

-- =====================================================
-- ФУНКЦИЯ: reorder_category (изменение порядка)
-- =====================================================
CREATE OR REPLACE FUNCTION public.reorder_category(
    p_category_id UUID,
    p_direction TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    cur RECORD;
    neighbor RECORD;
BEGIN
    SELECT * INTO cur
    FROM public.categories
    WHERE id = p_category_id AND user_id = uid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Категория не найдена';
    END IF;

    IF p_direction = 'up' THEN
        SELECT * INTO neighbor
        FROM public.categories
        WHERE user_id = uid
          AND type = cur.type
          AND parent_id IS NOT DISTINCT FROM cur.parent_id
          AND (
            sort_order < cur.sort_order
            OR (sort_order = cur.sort_order AND name < cur.name)
          )
        ORDER BY sort_order DESC, name DESC
        LIMIT 1;
    ELSIF p_direction = 'down' THEN
        SELECT * INTO neighbor
        FROM public.categories
        WHERE user_id = uid
          AND type = cur.type
          AND parent_id IS NOT DISTINCT FROM cur.parent_id
          AND (
            sort_order > cur.sort_order
            OR (sort_order = cur.sort_order AND name > cur.name)
          )
        ORDER BY sort_order ASC, name ASC
        LIMIT 1;
    ELSE
        RAISE EXCEPTION 'Неверное направление: %', p_direction;
    END IF;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    UPDATE public.categories SET sort_order = neighbor.sort_order WHERE id = cur.id;
    UPDATE public.categories SET sort_order = cur.sort_order WHERE id = neighbor.id;
END;
$$;

-- =====================================================
-- ФУНКЦИЯ: init_system_categories (категории по умолчанию)
-- =====================================================
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
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Пользователь не авторизован';
    END IF;

    IF auth.uid() IS NOT NULL AND uid IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Недопустимый user_id';
    END IF;

    -- Служебные (для долгов и переводов)
    PERFORM public.upsert_user_category(uid, 'Возврат долгов', 'income', NULL, 9000, '💰', '#10B981', TRUE);
    PERFORM public.upsert_user_category(uid, 'Долги', 'expense', NULL, 9000, '💳', '#EF4444', TRUE);
    PERFORM public.upsert_user_category(uid, 'Переводы', 'expense', NULL, 9001, '🔄', '#6B7280', TRUE);

    -- === ДОХОДЫ (по алфавиту) ===
    PERFORM public.upsert_user_category(uid, 'Долг', 'income', NULL, 0, '💳', '#10B981', FALSE);
    PERFORM public.upsert_user_category(uid, 'Другое', 'income', NULL, 1, '📋', '#6B7280', FALSE);
    PERFORM public.upsert_user_category(uid, 'Зарплата', 'income', NULL, 2, '💵', '#4F46E5', FALSE);
    PERFORM public.upsert_user_category(uid, 'Подарок', 'income', NULL, 3, '🎁', '#EC4899', FALSE);

    -- === РАСХОДЫ: родители по алфавиту ===

    -- Авто
    p := public.upsert_user_category(uid, 'Авто', 'expense', NULL, 0, '🚗', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Автоаксессуары/Инструмент', 'expense', p, 0, '🔧', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Налоги/Пошлины', 'expense', p, 1, '📋', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Обслуживание', 'expense', p, 2, '🛠️', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Покупка авто', 'expense', p, 3, '🚙', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Ремонт/Запчасти', 'expense', p, 4, '⚙️', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Топливо', 'expense', p, 5, '⛽', '#8B5CF6', FALSE);

    -- Банк
    p := public.upsert_user_category(uid, 'Банк', 'expense', NULL, 1, '🏦', '#4F46E5', FALSE);
    PERFORM public.upsert_user_category(uid, 'Комиссия', 'expense', p, 0, '💳', '#4F46E5', FALSE);
    PERFORM public.upsert_user_category(uid, 'Оплата услуг банка', 'expense', p, 1, '🏧', '#4F46E5', FALSE);
    PERFORM public.upsert_user_category(uid, 'Проценты', 'expense', p, 2, '📈', '#4F46E5', FALSE);

    -- Гаджеты/Компьютеры
    PERFORM public.upsert_user_category(uid, 'Гаджеты/Компьютеры', 'expense', NULL, 2, '💻', '#6366F1', FALSE);

    -- Дом
    p := public.upsert_user_category(uid, 'Дом', 'expense', NULL, 3, '🏠', '#F59E0B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Аренда', 'expense', p, 0, '🔑', '#F59E0B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Бытовая техника', 'expense', p, 1, '📺', '#F59E0B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Инструмент', 'expense', p, 2, '🔨', '#F59E0B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Мебель', 'expense', p, 3, '🛋️', '#F59E0B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Посуда', 'expense', p, 4, '🍽️', '#F59E0B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Ремонт', 'expense', p, 5, '🧱', '#F59E0B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Электроприборы', 'expense', p, 6, '💡', '#F59E0B', FALSE);

    -- Еда
    p := public.upsert_user_category(uid, 'Еда', 'expense', NULL, 4, '🍽️', '#EF4444', FALSE);
    PERFORM public.upsert_user_category(uid, 'Кафе', 'expense', p, 0, '☕', '#EF4444', FALSE);
    PERFORM public.upsert_user_category(uid, 'Обед', 'expense', p, 1, '🍱', '#EF4444', FALSE);
    PERFORM public.upsert_user_category(uid, 'Продукты', 'expense', p, 2, '🛒', '#EF4444', FALSE);

    -- Коммунальные услуги
    p := public.upsert_user_category(uid, 'Коммунальные услуги', 'expense', NULL, 5, '💡', '#14B8A6', FALSE);
    PERFORM public.upsert_user_category(uid, 'ОСИ/КСК', 'expense', p, 0, '🏢', '#14B8A6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Электроенергия/вода/газ', 'expense', p, 1, '⚡', '#14B8A6', FALSE);

    -- Красота и здоровье
    p := public.upsert_user_category(uid, 'Красота и здоровье', 'expense', NULL, 6, '💊', '#EC4899', FALSE);
    PERFORM public.upsert_user_category(uid, 'Гигиена', 'expense', p, 0, '🧴', '#EC4899', FALSE);
    PERFORM public.upsert_user_category(uid, 'Зубы', 'expense', p, 1, '🦷', '#EC4899', FALSE);
    PERFORM public.upsert_user_category(uid, 'Лекарства', 'expense', p, 2, '💊', '#EC4899', FALSE);
    PERFORM public.upsert_user_category(uid, 'Лечение', 'expense', p, 3, '🏥', '#EC4899', FALSE);
    PERFORM public.upsert_user_category(uid, 'Массаж', 'expense', p, 4, '💆', '#EC4899', FALSE);
    PERFORM public.upsert_user_category(uid, 'Стрижка', 'expense', p, 5, '✂️', '#EC4899', FALSE);

    -- Личное
    p := public.upsert_user_category(uid, 'Личное', 'expense', NULL, 7, '👤', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Благотворительность', 'expense', p, 0, '❤️', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Накопления/Копилка', 'expense', p, 1, '🐷', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Подарки', 'expense', p, 2, '🎁', '#8B5CF6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Подписки', 'expense', p, 3, '📱', '#8B5CF6', FALSE);

    -- Налоги/Пошлины (верхний уровень)
    PERFORM public.upsert_user_category(uid, 'Налоги/Пошлины', 'expense', NULL, 8, '📋', '#78716C', FALSE);

    -- Одежда
    p := public.upsert_user_category(uid, 'Одежда', 'expense', NULL, 9, '👕', '#A855F7', FALSE);
    PERFORM public.upsert_user_category(uid, 'Обувь', 'expense', p, 0, '👟', '#A855F7', FALSE);
    PERFORM public.upsert_user_category(uid, 'Одежда верхняя', 'expense', p, 1, '🧥', '#A855F7', FALSE);

    -- Отдых
    p := public.upsert_user_category(uid, 'Отдых', 'expense', NULL, 10, '🏖️', '#0EA5E9', FALSE);
    PERFORM public.upsert_user_category(uid, 'Выезд на природу', 'expense', p, 0, '🌲', '#0EA5E9', FALSE);
    PERFORM public.upsert_user_category(uid, 'Отель', 'expense', p, 1, '🏨', '#0EA5E9', FALSE);
    PERFORM public.upsert_user_category(uid, 'Рыбалка', 'expense', p, 2, '🎣', '#0EA5E9', FALSE);
    PERFORM public.upsert_user_category(uid, 'Тур', 'expense', p, 3, '✈️', '#0EA5E9', FALSE);

    -- Развлечение
    p := public.upsert_user_category(uid, 'Развлечение', 'expense', NULL, 11, '🎬', '#F97316', FALSE);
    PERFORM public.upsert_user_category(uid, 'Игрушки', 'expense', p, 0, '🧸', '#F97316', FALSE);
    PERFORM public.upsert_user_category(uid, 'Кино', 'expense', p, 1, '🎬', '#F97316', FALSE);
    PERFORM public.upsert_user_category(uid, 'Книги', 'expense', p, 2, '📚', '#F97316', FALSE);
    PERFORM public.upsert_user_category(uid, 'Концерт', 'expense', p, 3, '🎵', '#F97316', FALSE);

    -- Семья
    PERFORM public.upsert_user_category(uid, 'Семья', 'expense', NULL, 12, '👨‍👩‍👧', '#F472B6', FALSE);

    -- Спорт
    p := public.upsert_user_category(uid, 'Спорт', 'expense', NULL, 13, '🏋️', '#22C55E', FALSE);
    PERFORM public.upsert_user_category(uid, 'Бассейн', 'expense', p, 0, '🏊', '#22C55E', FALSE);
    PERFORM public.upsert_user_category(uid, 'Покупка тренажера', 'expense', p, 1, '🏋️', '#22C55E', FALSE);
    PERFORM public.upsert_user_category(uid, 'Тренажерный зал', 'expense', p, 2, '💪', '#22C55E', FALSE);

    -- Транспорт
    p := public.upsert_user_category(uid, 'Транспорт', 'expense', NULL, 14, '🚌', '#3B82F6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Аренда транспорта', 'expense', p, 0, '🚐', '#3B82F6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Общественный транспорт', 'expense', p, 1, '🚇', '#3B82F6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Поезд', 'expense', p, 2, '🚆', '#3B82F6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Самолет', 'expense', p, 3, '✈️', '#3B82F6', FALSE);
    PERFORM public.upsert_user_category(uid, 'Такси', 'expense', p, 4, '🚕', '#3B82F6', FALSE);

    -- Услуги
    p := public.upsert_user_category(uid, 'Услуги', 'expense', NULL, 15, '📞', '#64748B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Интернет(домашний/Мобильный)', 'expense', p, 0, '🌐', '#64748B', FALSE);
    PERFORM public.upsert_user_category(uid, 'Мобильная связь', 'expense', p, 1, '📱', '#64748B', FALSE);
END;
$$;

-- =====================================================
-- ФУНКЦИЯ: get_total_balance (общий баланс)
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
            AND t.is_excluded_from_budget = FALSE
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
-- ФУНКЦИЯ: get_account_balance (баланс одного счёта)
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
-- ФУНКЦИЯ: create_transfer (атомарный перевод)
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
-- Вспомогательная: calculate_next_scheduled_date
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
        WHEN 'weekly' THEN RETURN p_start_date + INTERVAL '7 days';
        WHEN 'biweekly' THEN RETURN p_start_date + INTERVAL '14 days';
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
-- ФУНКЦИЯ: process_scheduled_transactions (планировщик)
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
-- ФУНКЦИЯ: skip_scheduled_execution (пропустить выполнение)
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
-- ФУНКЦИЯ: execute_scheduled_now (выполнить сейчас)
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
        'Запланированная операция: ' || item.title || ' (выполнено вручную)', TRUE
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


-- #####################################################################
-- 2. ДОЛГИ
-- #####################################################################

-- =====================================================
-- ФУНКЦИЯ: create_debt (создание долга с бюджетом)
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

    -- Поиск активного долга у того же контакта (contact_id квалифицирован — без ambiguous)
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
-- ФУНКЦИЯ: add_debt_payment (добавление платежа по долгу)
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
-- ФУНКЦИЯ: get_debt_stats (статистика по долгам)
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
-- ФУНКЦИЯ: check_overdue_debts (проверка просрочек)
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


-- #####################################################################
-- 3. ОТЧЁТЫ И АНАЛИТИКА
-- #####################################################################

-- =====================================================
-- ФУНКЦИЯ: get_summary (сводка за период)
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
-- ФУНКЦИЯ: get_category_breakdown (структура по категориям)
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
-- ФУНКЦИЯ: get_balance_history (история баланса)
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
-- ФУНКЦИЯ: get_top_transactions (топ расходов)
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
-- ФУНКЦИЯ: get_comparison (сравнение с прошлым периодом)
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
-- ФУНКЦИЯ: get_forecast (прогноз)
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


-- #####################################################################
-- ФУНКЦИЯ: restore_user_backup (восстановление из JSON)
-- #####################################################################
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

    IF p_backup IS NULL OR p_backup->>'version' IS NULL THEN
        RAISE EXCEPTION 'Неверный формат бэкапа';
    END IF;

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
            row_data->>'type',
            COALESCE((row_data->>'is_archived')::BOOLEAN, FALSE),
            COALESCE((row_data->>'created_at')::TIMESTAMPTZ, NOW()),
            COALESCE((row_data->>'updated_at')::TIMESTAMPTZ, NOW())
        );
    END LOOP;

    FOR row_data IN
        SELECT * FROM jsonb_array_elements(COALESCE(p_backup->'categories', '[]'::jsonb))
    LOOP
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
            CASE
                WHEN row_data->'avatar_data' IS NULL OR row_data->'avatar_data' = 'null'::jsonb THEN NULL
                ELSE (row_data->>'avatar_data')::BYTEA
            END,
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
            COALESCE(
                ARRAY(SELECT jsonb_array_elements_text(COALESCE(row_data->'tags', '[]'::jsonb))),
                '{}'::TEXT[]
            ),
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
            id, debt_id, amount, date, note, transaction_id, created_at, updated_at
        )
        VALUES (
            (row_data->>'id')::UUID,
            v_debt_id,
            (row_data->>'amount')::DECIMAL,
            (row_data->>'date')::TIMESTAMPTZ,
            row_data->>'note',
            NULLIF(row_data->>'transaction_id', '')::UUID,
            COALESCE((row_data->>'created_at')::TIMESTAMPTZ, NOW()),
            COALESCE((row_data->>'updated_at')::TIMESTAMPTZ, NOW())
        );
    END LOOP;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Ошибка восстановления: %', SQLERRM;
END;
$$;


-- #####################################################################
-- ПРАВА ДОСТУПА (роль authenticated)
-- #####################################################################
GRANT EXECUTE ON FUNCTION public.init_system_categories(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_category(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_user_category(UUID, TEXT, TEXT, UUID, INTEGER, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_total_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_transfer(UUID, UUID, DECIMAL, DECIMAL, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_next_scheduled_date(TIMESTAMPTZ, TEXT, INTEGER) TO authenticated;
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
GRANT EXECUTE ON FUNCTION public.restore_user_backup(JSONB) TO authenticated;

-- #####################################################################
-- ФУНКЦИЯ: delete_own_account (миграция 20250111)
-- #####################################################################
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Пользователь не авторизован';
    END IF;

    DELETE FROM auth.users WHERE id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
