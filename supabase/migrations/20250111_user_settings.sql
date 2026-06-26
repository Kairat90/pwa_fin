-- Настройки пользователя: валюта по умолчанию и удаление аккаунта

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS default_currency TEXT NOT NULL DEFAULT 'KZT';

COMMENT ON COLUMN public.users.default_currency IS 'Валюта по умолчанию для отображения (KZT, RUB, USD, EUR)';

-- Удаление собственного аккаунта (каскадно удаляет public.users и все данные)
CREATE OR REPLACE FUNCTION public.delete_own_account()
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

    DELETE FROM auth.users WHERE id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
