-- =====================================================
-- Очистка проводок отменённых переводов (баг: delete без отката)
-- Баланс = initial_balance + SUM(transactions) — удаление проводок вернёт суммы
--
-- Как запускать в Supabase SQL Editor:
-- 1) Укажите EMAIL ниже
-- 2) Выполните блок PREVIEW — проверьте список
-- 3) Если всё верно — выполните блок CLEANUP
-- =====================================================

-- >>> укажите email аккаунта
-- \set не работает в Dashboard — правьте константу в обоих блоках

-- -------------------- PREVIEW --------------------
WITH me AS (
    SELECT id AS user_id
    FROM auth.users
    WHERE email = 'kajra1@bk.ru'  -- <-- ваш email
    LIMIT 1
),
tagged AS (
    -- Новые: есть tid:<uuid>, а transfer уже удалён
    SELECT t.*
    FROM public.transactions t
    CROSS JOIN me
    WHERE t.user_id = me.user_id
      AND 'transfer' = ANY (t.tags)
      AND EXISTS (
          SELECT 1
          FROM unnest(t.tags) AS tag
          WHERE tag LIKE 'tid:%'
            AND NOT EXISTS (
                SELECT 1
                FROM public.transfers tr
                WHERE tr.user_id = me.user_id
                  AND tr.id::TEXT = substring(tag FROM 5)
            )
      )
),
legacy AS (
    -- Старые без tid: пара debit/credit без записи в transfers
    SELECT d.id AS debit_id, c.id AS credit_id, d.*, c.amount AS credit_amount
    FROM public.transactions d
    JOIN public.transactions c
      ON c.user_id = d.user_id
     AND c.date = d.date
     AND c.amount > 0
     AND d.amount < 0
     AND 'transfer' = ANY (c.tags)
     AND 'transfer' = ANY (d.tags)
     AND NOT EXISTS (SELECT 1 FROM unnest(d.tags) g WHERE g LIKE 'tid:%')
     AND NOT EXISTS (SELECT 1 FROM unnest(c.tags) g WHERE g LIKE 'tid:%')
     AND (-d.amount - c.amount) >= 0  -- fee >= 0
    JOIN me ON d.user_id = me.user_id
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.transfers tr
        WHERE tr.user_id = d.user_id
          AND tr.from_account_id = d.account_id
          AND tr.to_account_id = c.account_id
          AND tr.amount = c.amount
          AND tr.date = d.date
          AND (tr.amount + COALESCE(tr.fee, 0)) = -d.amount
    )
)
SELECT
    'tagged_orphan' AS kind,
    t.id,
    t.account_id,
    t.amount,
    t.date,
    t.note,
    t.tags
FROM tagged t
UNION ALL
SELECT
    'legacy_debit' AS kind,
    d.id,
    d.account_id,
    d.amount,
    d.date,
    d.note,
    d.tags
FROM legacy
JOIN public.transactions d ON d.id = legacy.debit_id
UNION ALL
SELECT
    'legacy_credit' AS kind,
    c.id,
    c.account_id,
    c.amount,
    c.date,
    c.note,
    c.tags
FROM legacy
JOIN public.transactions c ON c.id = legacy.credit_id
ORDER BY date DESC, amount;


-- -------------------- CLEANUP (запускать отдельно после проверки PREVIEW) --------------------
/*
DO $$
DECLARE
    uid UUID;
    deleted_count INTEGER := 0;
BEGIN
    SELECT id INTO uid FROM auth.users WHERE email = 'kajra1@bk.ru' LIMIT 1;  -- <-- ваш email

    IF uid IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- 1) Orphans with tid:<uuid>
    WITH doomed AS (
        SELECT t.id
        FROM public.transactions t
        WHERE t.user_id = uid
          AND 'transfer' = ANY (t.tags)
          AND EXISTS (
              SELECT 1
              FROM unnest(t.tags) AS tag
              WHERE tag LIKE 'tid:%'
                AND NOT EXISTS (
                    SELECT 1
                    FROM public.transfers tr
                    WHERE tr.user_id = uid
                      AND tr.id::TEXT = substring(tag FROM 5)
                )
          )
    )
    DELETE FROM public.transactions t
    USING doomed
    WHERE t.id = doomed.id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted tagged orphans: %', deleted_count;

    -- 2) Legacy pairs without matching transfer
    WITH pairs AS (
        SELECT d.id AS debit_id, c.id AS credit_id
        FROM public.transactions d
        JOIN public.transactions c
          ON c.user_id = d.user_id
         AND c.date = d.date
         AND c.amount > 0
         AND d.amount < 0
         AND 'transfer' = ANY (c.tags)
         AND 'transfer' = ANY (d.tags)
         AND NOT EXISTS (SELECT 1 FROM unnest(d.tags) g WHERE g LIKE 'tid:%')
         AND NOT EXISTS (SELECT 1 FROM unnest(c.tags) g WHERE g LIKE 'tid:%')
         AND (-d.amount - c.amount) >= 0
        WHERE d.user_id = uid
          AND NOT EXISTS (
              SELECT 1
              FROM public.transfers tr
              WHERE tr.user_id = d.user_id
                AND tr.from_account_id = d.account_id
                AND tr.to_account_id = c.account_id
                AND tr.amount = c.amount
                AND tr.date = d.date
                AND (tr.amount + COALESCE(tr.fee, 0)) = -d.amount
          )
    ),
    doomed AS (
        SELECT debit_id AS id FROM pairs
        UNION
        SELECT credit_id FROM pairs
    )
    DELETE FROM public.transactions t
    USING doomed
    WHERE t.id = doomed.id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted legacy orphan pairs: %', deleted_count;
END $$;
*/
