-- sort_order для категорий + дерево по умолчанию + изменение порядка

ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(user_id, type, parent_id, sort_order);

-- Вставка/получение категории пользователя
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

-- Изменение порядка среди соседних категорий (один parent_id + type)
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

-- Дерево категорий по умолчанию (алфавитный порядок)
CREATE OR REPLACE FUNCTION public.init_system_categories(p_user_id UUID DEFAULT auth.uid())
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := p_user_id;
    p UUID;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Пользователь не авторизован';
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

GRANT EXECUTE ON FUNCTION public.reorder_category(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_user_category(UUID, TEXT, TEXT, UUID, INTEGER, TEXT, TEXT, BOOLEAN) TO authenticated;
