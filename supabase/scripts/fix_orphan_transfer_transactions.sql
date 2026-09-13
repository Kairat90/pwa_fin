-- =====================================================
-- Очистка проводок отменённых переводов (баг: delete transfers без rollback)
-- 1) Подставьте email
-- 2) Сначала выполните блок PREVIEW
-- 3) Если список верный — выполните блок DELETE
-- =====================================================

-- >>> Укажите email аккаунта:
-- (пример из приложения; при необходимости замените)
DO $$ BEGIN NULL; END $$; -- noop, см. CTE ниже

-- ---------- PREVIEW: что будет удалено ----------
WITH me AS (
    SELECT id AS user_id
    FROM auth.users
    WHERE email = 'kajra1@bk.ru'  -- ← при необходимости замените email
),
matched AS (
    -- Проводки, которые ещё привязаны к существующему переводу
    SELECT DISTINCT t.id
    FROM public.transactions t
    JOIN me ON me.user_id = t.user_id
    JOIN public.transfers tr ON tr.user_id = t.user_id
    WHERE 'transfer' = ANY (t.tags)
      AND (
            ('tid:' || tr.id::TEXT) = ANY (t.tags)
         OR (
                t.date = tr.date
            AND (
                    (t.account_id = tr.from_account_id
                     AND t.amount = -(tr.amount + COALESCE(tr.fee, 0)))
                 OR (t.account_id = tr.to_account_id
                     AND t.amount = tr.amount)
                )
            )
      )
),
orphans AS (
    SELECT t.*
    FROM public.transactions t
    JOIN me ON me.user_id = t.user_id
    WHERE 'transfer' = ANY (t.tags)
      AND t.id NOT IN (SELECT id FROM matched)
)
SELECT
    o.id,
    o.account_id,
    a.name AS account_name,
    o.amount,
    o.date,
    o.note,
    o.tags,
    o.created_at
FROM orphans o
LEFT JOIN public.accounts a ON a.id = o.account_id
ORDER BY o.date DESC, o.created_at DESC;


-- ---------- DELETE: раскомментируйте и выполните после проверки PREVIEW ----------
/*
WITH me AS (
    SELECT id AS user_id
    FROM auth.users
    WHERE email = 'kajra1@bk.ru'  -- ← тот же email
),
matched AS (
    SELECT DISTINCT t.id
    FROM public.transactions t
    JOIN me ON me.user_id = t.user_id
    JOIN public.transfers tr ON tr.user_id = t.user_id
    WHERE 'transfer' = ANY (t.tags)
      AND (
            ('tid:' || tr.id::TEXT) = ANY (t.tags)
         OR (
                t.date = tr.date
            AND (
                    (t.account_id = tr.from_account_id
                     AND t.amount = -(tr.amount + COALESCE(tr.fee, 0)))
                 OR (t.account_id = tr.to_account_id
                     AND t.amount = tr.amount)
                )
            )
      )
),
orphans AS (
    SELECT t.id
    FROM public.transactions t
    JOIN me ON me.user_id = t.user_id
    WHERE 'transfer' = ANY (t.tags)
      AND t.id NOT IN (SELECT id FROM matched)
)
DELETE FROM public.transactions t
USING orphans o
WHERE t.id = o.id
RETURNING t.id, t.account_id, t.amount, t.note;
*/
