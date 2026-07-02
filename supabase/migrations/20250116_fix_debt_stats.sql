-- Исправление сводки долгов: в «погашено» учитываются только repayment, не initial/increase

CREATE OR REPLACE FUNCTION public.get_debt_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    total_i_owe DECIMAL := 0;
    total_owed_to_me DECIMAL := 0;
    overdue_count INTEGER := 0;
    active_count INTEGER := 0;
    total_debts INTEGER := 0;
    d RECORD;
    paid DECIMAL;
    remaining DECIMAL;
BEGIN
    FOR d IN
        SELECT * FROM public.debts
        WHERE user_id = uid AND status IN ('active', 'overdue')
    LOOP
        SELECT COALESCE(SUM(dp.amount), 0) INTO paid
        FROM public.debt_payments dp
        WHERE dp.debt_id = d.id
          AND COALESCE(dp.entry_type, 'repayment') = 'repayment';

        remaining := GREATEST(0, d.amount - paid);

        IF d.type = 'iOwe' THEN
            total_i_owe := total_i_owe + remaining;
        ELSE
            total_owed_to_me := total_owed_to_me + remaining;
        END IF;

        IF d.status = 'overdue' THEN
            overdue_count := overdue_count + 1;
        END IF;

        IF d.status = 'active' THEN
            active_count := active_count + 1;
        END IF;

        total_debts := total_debts + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'totalIOwe', total_i_owe,
        'totalOwedToMe', total_owed_to_me,
        'netPosition', total_owed_to_me - total_i_owe,
        'overdueCount', overdue_count,
        'activeCount', active_count,
        'totalDebts', total_debts
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_debt_stats() TO authenticated;
