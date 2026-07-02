-- Счёт по умолчанию для дашборда и быстрых операций

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS default_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.users.default_account_id IS 'Основной счёт пользователя (дашборд, формы по умолчанию)';

CREATE INDEX IF NOT EXISTS idx_users_default_account_id ON public.users(default_account_id);

-- Установка основного счёта (только свой активный счёт)
CREATE OR REPLACE FUNCTION public.set_default_account(p_account_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Пользователь не авторизован';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.accounts
        WHERE id = p_account_id
          AND user_id = uid
          AND is_archived = FALSE
    ) THEN
        RAISE EXCEPTION 'Счёт не найден или архивирован';
    END IF;

    UPDATE public.users
    SET default_account_id = p_account_id
    WHERE id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_default_account(UUID) TO authenticated;
