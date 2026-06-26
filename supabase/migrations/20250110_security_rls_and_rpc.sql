-- Безопасность: RLS по FK, проверка user_id в RPC категорий, валидация debt_payments при восстановлении

-- =====================================================
-- Вспомогательные функции для RLS (вызов от имени пользователя)
-- =====================================================

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

-- =====================================================
-- RLS: категории (parent_id)
-- =====================================================

DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
CREATE POLICY "Users can insert own categories" ON public.categories
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND (
            parent_id IS NULL
            OR public.current_user_owns_category(parent_id)
        )
    );

DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
CREATE POLICY "Users can update own categories" ON public.categories
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id
        AND (
            parent_id IS NULL
            OR public.current_user_owns_category(parent_id)
        )
    );

-- =====================================================
-- RLS: транзакции (account_id, category_id)
-- =====================================================

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
CREATE POLICY "Users can insert own transactions" ON public.transactions
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND public.current_user_owns_account(account_id)
        AND (
            category_id IS NULL
            OR public.current_user_owns_category(category_id)
        )
    );

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions" ON public.transactions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id
        AND public.current_user_owns_account(account_id)
        AND (
            category_id IS NULL
            OR public.current_user_owns_category(category_id)
        )
    );

-- =====================================================
-- RLS: переводы (from_account_id, to_account_id)
-- =====================================================

DROP POLICY IF EXISTS "Users can insert own transfers" ON public.transfers;
CREATE POLICY "Users can insert own transfers" ON public.transfers
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND public.current_user_owns_account(from_account_id)
        AND public.current_user_owns_account(to_account_id)
    );

DROP POLICY IF EXISTS "Users can update own transfers" ON public.transfers;
CREATE POLICY "Users can update own transfers" ON public.transfers
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id
        AND public.current_user_owns_account(from_account_id)
        AND public.current_user_owns_account(to_account_id)
    );

-- =====================================================
-- RLS: запланированные операции (account_id, category_id)
-- =====================================================

DROP POLICY IF EXISTS "Users can insert own scheduled" ON public.scheduled_transactions;
CREATE POLICY "Users can insert own scheduled" ON public.scheduled_transactions
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND public.current_user_owns_account(account_id)
        AND (
            category_id IS NULL
            OR public.current_user_owns_category(category_id)
        )
    );

DROP POLICY IF EXISTS "Users can update own scheduled" ON public.scheduled_transactions;
CREATE POLICY "Users can update own scheduled" ON public.scheduled_transactions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id
        AND public.current_user_owns_account(account_id)
        AND (
            category_id IS NULL
            OR public.current_user_owns_category(category_id)
        )
    );

-- =====================================================
-- RLS: долги (contact_id, account_id)
-- =====================================================

DROP POLICY IF EXISTS "Users can insert own debts" ON public.debts;
CREATE POLICY "Users can insert own debts" ON public.debts
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND public.current_user_owns_contact(contact_id)
        AND (
            account_id IS NULL
            OR public.current_user_owns_account(account_id)
        )
    );

DROP POLICY IF EXISTS "Users can update own debts" ON public.debts;
CREATE POLICY "Users can update own debts" ON public.debts
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id
        AND public.current_user_owns_contact(contact_id)
        AND (
            account_id IS NULL
            OR public.current_user_owns_account(account_id)
        )
    );

-- =====================================================
-- RPC: upsert_user_category — только свой user_id
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
-- RPC: init_system_categories — запрет действий от чужого user_id
-- (auth.uid() = NULL допускается для триггера handle_new_user)
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

-- =====================================================
-- RPC: restore_user_backup — проверка debt_id при вставке платежей
-- =====================================================

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
