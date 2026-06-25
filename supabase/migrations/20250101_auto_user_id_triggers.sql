-- Автоматическая подстановка user_id из auth.uid() при INSERT
-- После этого в клиентском коде не нужно передавать user_id

CREATE OR REPLACE FUNCTION public.set_auth_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        NEW.user_id := auth.uid();
    END IF;

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Пользователь не авторизован';
    END IF;

    IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Недопустимый user_id';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER accounts_set_user_id
    BEFORE INSERT ON accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_auth_user_id();

CREATE TRIGGER categories_set_user_id
    BEFORE INSERT ON categories
    FOR EACH ROW EXECUTE FUNCTION public.set_auth_user_id();

CREATE TRIGGER transactions_set_user_id
    BEFORE INSERT ON transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_auth_user_id();

CREATE TRIGGER transfers_set_user_id
    BEFORE INSERT ON transfers
    FOR EACH ROW EXECUTE FUNCTION public.set_auth_user_id();

CREATE TRIGGER scheduled_set_user_id
    BEFORE INSERT ON scheduled_transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_auth_user_id();

CREATE TRIGGER contacts_set_user_id
    BEFORE INSERT ON contacts
    FOR EACH ROW EXECUTE FUNCTION public.set_auth_user_id();

CREATE TRIGGER debts_set_user_id
    BEFORE INSERT ON debts
    FOR EACH ROW EXECUTE FUNCTION public.set_auth_user_id();
