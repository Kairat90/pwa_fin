-- Проверка миграции 20261104 на копии: чужие строки, пустой бэкап, валюта долга, anon.
-- Ожидается уже накатанная схема и заглушка auth.

CREATE OR REPLACE FUNCTION public._test_jwt(p_sub TEXT, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', COALESCE(p_sub, ''), false);
    PERFORM set_config('request.jwt.claim.role', COALESCE(p_role, ''), false);
    PERFORM set_config('request.jwt.claims', '', false);
END;
$$;

SELECT public._test_jwt('', '');

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
    ('11111111-1111-4111-8111-111111111111', 'a@copy.test', '{}'::jsonb),
    ('22222222-2222-4222-8222-222222222222', 'b@copy.test', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, name)
VALUES
    ('11111111-1111-4111-8111-111111111111', 'a@copy.test', 'A'),
    ('22222222-2222-4222-8222-222222222222', 'b@copy.test', 'B')
ON CONFLICT (id) DO NOTHING;

SELECT public._test_jwt('22222222-2222-4222-8222-222222222222', 'authenticated');

INSERT INTO public.accounts (id, user_id, name, currency, initial_balance)
VALUES ('b0000001-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Счёт B', 'KZT', 1000);

SELECT public._test_jwt('11111111-1111-4111-8111-111111111111', 'authenticated');

INSERT INTO public.accounts (id, user_id, name, currency, initial_balance)
VALUES ('a0000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Счёт A', 'KZT', 50);

INSERT INTO public.contacts (id, user_id, name)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Иван');

INSERT INTO public.transactions (user_id, account_id, amount, date, note)
VALUES (
    '11111111-1111-4111-8111-111111111111',
    'b0000001-0000-4000-8000-000000000001',
    -400,
    NOW(),
    'чужая проводка на счёте B'
);

SELECT public.create_debt(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    NULL, 100, 'USD', 'iOwe', NOW(), NULL, NULL, NULL, FALSE, 3
);

SELECT public.create_debt(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    NULL, 50000, 'KZT', 'iOwe', NOW(), NULL, NULL, NULL, FALSE, 3
);

SELECT public.create_debt(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    NULL, 10, 'usd', 'iOwe', NOW(), NULL, NULL, NULL, FALSE, 3
);

DO $$
DECLARE
    debt_count INTEGER;
    usd_amount NUMERIC;
    kzt_amount NUMERIC;
    balance_b NUMERIC;
    balance_a NUMERIC;
    accounts_before INTEGER;
BEGIN
    SELECT count(*) INTO debt_count
    FROM public.debts
    WHERE user_id = '11111111-1111-4111-8111-111111111111';

    IF debt_count <> 2 THEN
        RAISE EXCEPTION 'Ожидались 2 долга разных валют, получено %', debt_count;
    END IF;

    SELECT amount INTO usd_amount FROM public.debts
    WHERE user_id = '11111111-1111-4111-8111-111111111111' AND upper(currency) = 'USD';

    SELECT amount INTO kzt_amount FROM public.debts
    WHERE user_id = '11111111-1111-4111-8111-111111111111' AND upper(currency) = 'KZT';

    IF usd_amount <> 110 OR kzt_amount <> 50000 THEN
        RAISE EXCEPTION 'Суммы долгов не сошлись: USD %, KZT %', usd_amount, kzt_amount;
    END IF;

    PERFORM public._test_jwt('22222222-2222-4222-8222-222222222222', 'authenticated');
    balance_b := public.get_account_balance('b0000001-0000-4000-8000-000000000001');

    IF balance_b <> 1000 THEN
        RAISE EXCEPTION 'Баланс B учитывает чужую проводку: %', balance_b;
    END IF;

    PERFORM public._test_jwt('11111111-1111-4111-8111-111111111111', 'authenticated');
    balance_a := public.get_total_balance();

    IF balance_a <> 50 THEN
        RAISE EXCEPTION 'Общий баланс A искажён: %', balance_a;
    END IF;

    SELECT count(*) INTO accounts_before FROM public.accounts
    WHERE user_id = '11111111-1111-4111-8111-111111111111';

    BEGIN
        PERFORM public.restore_user_backup('{"version":"1.0"}'::jsonb);
        RAISE EXCEPTION 'Пустой бэкап без даты принят';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM NOT ILIKE '%даты экспорта%' THEN
                RAISE EXCEPTION 'Неожиданная ошибка пустого бэкапа: %', SQLERRM;
            END IF;
    END;

    BEGIN
        PERFORM public.restore_user_backup('{"version":"1.0.0","exportedAt":"2026-11-04T00:00:00Z"}'::jsonb);
        RAISE EXCEPTION 'Бэкап без строк принят';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM NOT ILIKE '%не содержит данных%' THEN
                RAISE EXCEPTION 'Неожиданная ошибка пустых таблиц: %', SQLERRM;
            END IF;
    END;

    BEGIN
        PERFORM public.restore_user_backup(jsonb_build_object(
            'version', '1.0.0',
            'exportedAt', '2026-11-04T00:00:00Z',
            'accounts', jsonb_build_array(jsonb_build_object(
                'id', 'a0000001-0000-4000-8000-000000000001',
                'name', 'Счёт A',
                'currency', 'KZT',
                'initial_balance', 50
            )),
            'transactions', jsonb_build_array(jsonb_build_object(
                'id', 'c0000001-0000-4000-8000-000000000001',
                'account_id', 'b0000001-0000-4000-8000-000000000001',
                'amount', -999,
                'date', '2026-11-04T00:00:00Z'
            ))
        ));
        RAISE EXCEPTION 'Бэкап с чужим счётом принят';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM NOT ILIKE '%счёт, которого нет в бэкапе%' THEN
                RAISE EXCEPTION 'Неожиданная ошибка чужого счёта: %', SQLERRM;
            END IF;
    END;

    IF (SELECT count(*) FROM public.accounts WHERE id = 'a0000001-0000-4000-8000-000000000001') <> 1 THEN
        RAISE EXCEPTION 'Неудачное восстановление удалило счёт A';
    END IF;

    IF (SELECT count(*) FROM public.accounts WHERE id = 'b0000001-0000-4000-8000-000000000001') <> 1 THEN
        RAISE EXCEPTION 'Неудачное восстановление задело счёт B';
    END IF;

    IF (SELECT count(*) FROM public.accounts WHERE user_id = '11111111-1111-4111-8111-111111111111') <> accounts_before THEN
        RAISE EXCEPTION 'Число счетов A изменилось после отказа';
    END IF;

    PERFORM public.restore_user_backup(jsonb_build_object(
        'version', '1.0.0',
        'exportedAt', '2026-11-04T00:00:00Z',
        'accounts', jsonb_build_array(jsonb_build_object(
            'id', 'a0000001-0000-4000-8000-000000000001',
            'name', 'После восстановления',
            'currency', 'KZT',
            'initial_balance', 7
        ))
    ));

    IF (SELECT name FROM public.accounts WHERE id = 'a0000001-0000-4000-8000-000000000001') <> 'После восстановления' THEN
        RAISE EXCEPTION 'Свой бэкап не восстановил счёт A';
    END IF;

    IF (SELECT initial_balance FROM public.accounts WHERE id = 'b0000001-0000-4000-8000-000000000001') <> 1000 THEN
        RAISE EXCEPTION 'Восстановление A изменило счёт B';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.accounts
        WHERE id = 'b0000001-0000-4000-8000-000000000001'
          AND user_id = '22222222-2222-4222-8222-222222222222'
    ) THEN
        RAISE EXCEPTION 'Счёт B сменил владельца';
    END IF;
END;
$$;

DO $$
BEGIN
    IF has_function_privilege('anon', 'public.init_system_categories(uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'anon может выполнять init_system_categories';
    END IF;

    IF has_function_privilege(
        'anon',
        'public.upsert_user_category(uuid, text, text, uuid, integer, text, text, boolean)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'anon может выполнять upsert_user_category';
    END IF;

    IF has_function_privilege('anon', 'public.restore_user_backup(jsonb)', 'EXECUTE') THEN
        RAISE EXCEPTION 'anon может выполнять restore_user_backup';
    END IF;

    IF has_function_privilege('anon', 'public.create_debt(uuid, uuid, numeric, text, text, timestamp with time zone, timestamp with time zone, text, real, boolean, integer)', 'EXECUTE') THEN
        RAISE EXCEPTION 'anon может выполнять create_debt';
    END IF;

    IF NOT has_function_privilege('authenticated', 'public.restore_user_backup(jsonb)', 'EXECUTE') THEN
        RAISE EXCEPTION 'authenticated потерял restore_user_backup';
    END IF;

    IF NOT has_function_privilege('authenticated', 'public.create_debt(uuid, uuid, numeric, text, text, timestamp with time zone, timestamp with time zone, text, real, boolean, integer)', 'EXECUTE') THEN
        RAISE EXCEPTION 'authenticated потерял create_debt';
    END IF;
END;
$$;

DO $$
DECLARE
    called BOOLEAN := FALSE;
BEGIN
    BEGIN
        EXECUTE 'SET LOCAL ROLE anon';
        PERFORM set_config('request.jwt.claim.role', 'anon', true);
        PERFORM set_config('request.jwt.claim.sub', '', true);
        PERFORM public.init_system_categories('11111111-1111-4111-8111-111111111111');
        called := TRUE;
    EXCEPTION
        WHEN insufficient_privilege THEN
            called := FALSE;
        WHEN OTHERS THEN
            IF SQLERRM ILIKE '%Недостаточно прав%' OR SQLERRM ILIKE '%permission denied%' THEN
                called := FALSE;
            ELSE
                RAISE EXCEPTION 'anon init: % [%]', SQLERRM, SQLSTATE;
            END IF;
    END;

    IF called THEN
        RAISE EXCEPTION 'anon вызвал init_system_categories';
    END IF;
END;
$$;

SELECT public._test_jwt('', '');

SELECT public.assert_category_write_user('11111111-1111-4111-8111-111111111111'::uuid);

SELECT public._test_jwt('11111111-1111-4111-8111-111111111111', 'authenticated');

DO $$
BEGIN
    BEGIN
        PERFORM public.init_system_categories('22222222-2222-4222-8222-222222222222');
        RAISE EXCEPTION 'Чужой user_id принят';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM NOT ILIKE '%Недопустимый user_id%' THEN
                RAISE EXCEPTION 'Чужой user_id: %', SQLERRM;
            END IF;
    END;

    PERFORM public.init_system_categories('11111111-1111-4111-8111-111111111111');

    IF (SELECT count(*) FROM public.categories WHERE user_id = '11111111-1111-4111-8111-111111111111') < 5 THEN
        RAISE EXCEPTION 'Свои категории не создались';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.categories
        WHERE user_id = '22222222-2222-4222-8222-222222222222'
          AND name = 'Зарплата'
    ) THEN
        RAISE EXCEPTION 'Категории записались пользователю B';
    END IF;
END;
$$;

SELECT public._test_jwt('22222222-2222-4222-8222-222222222222', 'authenticated');

DO $$
DECLARE
    balance_b NUMERIC;
BEGIN
    balance_b := public.get_account_balance('b0000001-0000-4000-8000-000000000001');

    IF balance_b <> 1000 THEN
        RAISE EXCEPTION 'После восстановления баланс B = %', balance_b;
    END IF;
END;
$$;

SELECT public._test_jwt('11111111-1111-4111-8111-111111111111', 'authenticated');

DO $$
BEGIN
    BEGIN
        PERFORM public.restore_user_backup(jsonb_build_object(
            'version', '1.0.0',
            'exportedAt', '2026-11-04T00:00:00Z',
            'accounts', jsonb_build_array(
                jsonb_build_object(
                    'id', 'a0000001-0000-4000-8000-000000000001',
                    'name', 'После восстановления',
                    'currency', 'KZT',
                    'initial_balance', 7
                ),
                jsonb_build_object(
                    'id', 'b0000001-0000-4000-8000-000000000001',
                    'name', 'Украденный',
                    'currency', 'KZT',
                    'initial_balance', 1
                )
            )
        ));
        RAISE EXCEPTION 'Чужой id в списке счетов принят';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM NOT ILIKE '%чужую запись%' THEN
                RAISE EXCEPTION 'Чужой id счета: %', SQLERRM;
            END IF;
    END;

    IF (SELECT name FROM public.accounts WHERE id = 'b0000001-0000-4000-8000-000000000001') <> 'Счёт B' THEN
        RAISE EXCEPTION 'Чужой счёт перезаписан';
    END IF;

    IF (SELECT user_id FROM public.accounts WHERE id = 'b0000001-0000-4000-8000-000000000001')
        <> '22222222-2222-4222-8222-222222222222' THEN
        RAISE EXCEPTION 'Владелец счёта B сменился';
    END IF;

    IF (SELECT name FROM public.accounts WHERE id = 'a0000001-0000-4000-8000-000000000001') <> 'После восстановления' THEN
        RAISE EXCEPTION 'Отказ на чужом id всё равно заменил счёт A';
    END IF;
END;
$$;
