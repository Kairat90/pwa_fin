-- Исправление restore_user_backup: безопасные приведения типов и понятные ошибки

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
        INSERT INTO public.debt_payments (
            id, debt_id, amount, date, note, transaction_id, created_at, updated_at
        )
        VALUES (
            (row_data->>'id')::UUID,
            (row_data->>'debt_id')::UUID,
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
