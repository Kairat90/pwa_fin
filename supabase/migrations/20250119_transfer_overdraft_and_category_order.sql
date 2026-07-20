-- Разрешить переводы при отрицаном балансе исходящего счёта
-- Исправить сохранение порядка категорий (не сбрасывать sort_order при init)

-- =====================================================
-- create_transfer: без проверки «достаточно средств»
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

    IF amount IS NULL OR amount <= 0 THEN
        RAISE EXCEPTION 'Сумма перевода должна быть больше 0';
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
-- upsert_user_category: не перезаписывать sort_order у существующих
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
        SET is_system = p_is_system OR categories.is_system
        WHERE id = v_id;
    END IF;

    RETURN v_id;
END;
$$;

-- =====================================================
-- reorder_category: обмен позиций + перенумерация соседей
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
    sibling_ids UUID[];
    cur_idx INTEGER;
    swap_idx INTEGER;
    i INTEGER;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Пользователь не авторизован';
    END IF;

    SELECT * INTO cur
    FROM public.categories
    WHERE id = p_category_id AND user_id = uid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Категория не найдена';
    END IF;

    SELECT ARRAY_AGG(id ORDER BY sort_order ASC, name ASC)
    INTO sibling_ids
    FROM public.categories
    WHERE user_id = uid
      AND type = cur.type
      AND parent_id IS NOT DISTINCT FROM cur.parent_id
      AND is_system IS NOT DISTINCT FROM cur.is_system;

    IF sibling_ids IS NULL OR array_length(sibling_ids, 1) < 2 THEN
        RETURN;
    END IF;

    cur_idx := array_position(sibling_ids, cur.id);

    IF cur_idx IS NULL THEN
        RETURN;
    END IF;

    IF p_direction = 'up' THEN
        IF cur_idx <= 1 THEN
            RETURN;
        END IF;
        swap_idx := cur_idx - 1;
    ELSIF p_direction = 'down' THEN
        IF cur_idx >= array_length(sibling_ids, 1) THEN
            RETURN;
        END IF;
        swap_idx := cur_idx + 1;
    ELSE
        RAISE EXCEPTION 'Неверное направление: %', p_direction;
    END IF;

    sibling_ids[cur_idx] := sibling_ids[swap_idx];
    sibling_ids[swap_idx] := cur.id;

    FOR i IN 1 .. array_length(sibling_ids, 1) LOOP
        UPDATE public.categories
        SET sort_order = i - 1
        WHERE id = sibling_ids[i];
    END LOOP;
END;
$$;
