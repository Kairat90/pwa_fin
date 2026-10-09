-- =====================================================
-- Необязательно: привести даты старых операций к полудню их дня.
-- Приложение больше не хранит время — новые записи сохраняются как 12:00.
-- У старых записей осталось реальное время; запись, сделанная с 00:00 до 05:00
-- по местному времени, в UTC приходится на предыдущий день и может попасть
-- в отчёт не за тот день.
--
-- Часовой пояс: UTC+5 (Казахстан). Если у вас другой — замените '5 hours' везде.
-- Порядок: 1) выполнить PREVIEW, 2) выполнить UPDATE.
-- Скрипт идемпотентен: повторный запуск ничего не меняет.
-- =====================================================

-- ---------- 1. PREVIEW: сколько записей изменится ----------
SELECT 'transactions' AS table_name, COUNT(*) AS rows_to_fix
FROM transactions
WHERE date <> ((((date AT TIME ZONE 'UTC') + INTERVAL '5 hours')::date + TIME '12:00') - INTERVAL '5 hours') AT TIME ZONE 'UTC'
UNION ALL
SELECT 'transfers', COUNT(*)
FROM transfers
WHERE date <> ((((date AT TIME ZONE 'UTC') + INTERVAL '5 hours')::date + TIME '12:00') - INTERVAL '5 hours') AT TIME ZONE 'UTC'
UNION ALL
SELECT 'debt_payments', COUNT(*)
FROM debt_payments
WHERE date <> ((((date AT TIME ZONE 'UTC') + INTERVAL '5 hours')::date + TIME '12:00') - INTERVAL '5 hours') AT TIME ZONE 'UTC'
UNION ALL
SELECT 'debts.date_taken', COUNT(*)
FROM debts
WHERE date_taken <> ((((date_taken AT TIME ZONE 'UTC') + INTERVAL '5 hours')::date + TIME '12:00') - INTERVAL '5 hours') AT TIME ZONE 'UTC';

-- ---------- 2. UPDATE: выполнять после проверки PREVIEW ----------
/*
BEGIN;

UPDATE transactions
SET date = ((((date AT TIME ZONE 'UTC') + INTERVAL '5 hours')::date + TIME '12:00') - INTERVAL '5 hours') AT TIME ZONE 'UTC'
WHERE date <> ((((date AT TIME ZONE 'UTC') + INTERVAL '5 hours')::date + TIME '12:00') - INTERVAL '5 hours') AT TIME ZONE 'UTC';

UPDATE transfers
SET date = ((((date AT TIME ZONE 'UTC') + INTERVAL '5 hours')::date + TIME '12:00') - INTERVAL '5 hours') AT TIME ZONE 'UTC'
WHERE date <> ((((date AT TIME ZONE 'UTC') + INTERVAL '5 hours')::date + TIME '12:00') - INTERVAL '5 hours') AT TIME ZONE 'UTC';

UPDATE debt_payments
SET date = ((((date AT TIME ZONE 'UTC') + INTERVAL '5 hours')::date + TIME '12:00') - INTERVAL '5 hours') AT TIME ZONE 'UTC'
WHERE date <> ((((date AT TIME ZONE 'UTC') + INTERVAL '5 hours')::date + TIME '12:00') - INTERVAL '5 hours') AT TIME ZONE 'UTC';

UPDATE debts
SET date_taken = ((((date_taken AT TIME ZONE 'UTC') + INTERVAL '5 hours')::date + TIME '12:00') - INTERVAL '5 hours') AT TIME ZONE 'UTC'
WHERE date_taken <> ((((date_taken AT TIME ZONE 'UTC') + INTERVAL '5 hours')::date + TIME '12:00') - INTERVAL '5 hours') AT TIME ZONE 'UTC';

COMMIT;
*/
