-- Разрешить изменение порядка у всех категорий (включая системные и подкатегории)

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
