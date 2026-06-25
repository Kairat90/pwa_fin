-- =====================================================
-- Тестовые данные для Supabase
-- =====================================================
-- ВАЖНО: пользователи создаются через Supabase Auth.
-- После регистрации тестового пользователя (test@example.com)
-- профиль и категории создаются автоматически (триггер handle_new_user).
--
-- Чтобы добавить демо-данные:
-- 1. Зарегистрируйтесь в приложении или через Dashboard → Authentication
-- 2. Скопируйте UUID пользователя из таблицы auth.users
-- 3. Раскомментируйте и подставьте свой UUID ниже

-- Пример (замените YOUR_USER_ID на реальный UUID):
/*
DO $$
DECLARE
    uid UUID := 'YOUR_USER_ID';
    acc_main UUID;
    acc_cash UUID;
    cat_products UUID;
    cat_salary UUID;
BEGIN
    -- Счета
    INSERT INTO accounts (user_id, name, currency, initial_balance, icon, color, type)
    VALUES (uid, 'Основной счёт', 'KZT', 500000, '💳', '#4F46E5', 'card')
    RETURNING id INTO acc_main;

    INSERT INTO accounts (user_id, name, currency, initial_balance, icon, color, type)
    VALUES (uid, 'Наличные', 'KZT', 50000, '💵', '#10B981', 'cash')
    RETURNING id INTO acc_cash;

    SELECT id INTO cat_products FROM categories
    WHERE user_id = uid AND name = 'Продукты' LIMIT 1;

    SELECT id INTO cat_salary FROM categories
    WHERE user_id = uid AND name = 'Зарплата' LIMIT 1;

    -- Транзакции
    INSERT INTO transactions (user_id, account_id, category_id, amount, date, note)
    VALUES
        (uid, acc_main, cat_salary, 500000, NOW() - INTERVAL '5 days', 'Зарплата за месяц'),
        (uid, acc_main, cat_products, -15000, NOW() - INTERVAL '2 days', 'Продукты в супермаркете'),
        (uid, acc_cash, cat_products, -3500, NOW() - INTERVAL '1 day', 'Хлеб и молоко');

    -- Контакт и долг
    DECLARE
        contact_id UUID;
    BEGIN
        INSERT INTO contacts (user_id, name, phone, is_favorite)
        VALUES (uid, 'Иван Петров', '+77001234567', TRUE)
        RETURNING id INTO contact_id;

        PERFORM create_debt(
            contact_id,
            acc_main,
            100000,
            'KZT',
            'owedToMe',
            NOW() - INTERVAL '10 days',
            NOW() + INTERVAL '20 days',
            'За ремонт',
            NULL,
            TRUE,
            3
        );
    END;
END $$;
*/

-- Системные категории для существующих пользователей без категорий
DO $$
DECLARE
    u RECORD;
BEGIN
    FOR u IN SELECT id FROM users LOOP
        PERFORM init_system_categories(u.id);
    END LOOP;
END $$;
