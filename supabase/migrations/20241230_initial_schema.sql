-- =====================================================
-- PWA «Финансовый учёт» — начальная схема Supabase
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. Пользователи (профиль, связан с auth.users)
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE users IS 'Профили пользователей приложения';

-- =====================================================
-- 2. Счета
-- =====================================================
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KZT',
    initial_balance DECIMAL(12,2) DEFAULT 0,
    icon TEXT,
    color TEXT,
    type TEXT CHECK (type IN ('cash', 'card', 'investment', 'savings')),
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE accounts IS 'Счета пользователей';

-- =====================================================
-- 3. Категории
-- =====================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE categories IS 'Категории доходов и расходов';

-- =====================================================
-- 4. Транзакции
-- =====================================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    note TEXT,
    tags TEXT[] DEFAULT '{}',
    is_excluded_from_budget BOOLEAN DEFAULT FALSE,
    is_scheduled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE transactions IS 'Транзакции (доходы и расходы)';

-- =====================================================
-- 5. Переводы
-- =====================================================
CREATE TABLE transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    to_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    converted_amount DECIMAL(12,2),
    fee DECIMAL(12,2) DEFAULT 0,
    date TIMESTAMPTZ NOT NULL,
    note TEXT,
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE transfers IS 'Переводы между счетами';

-- =====================================================
-- 6. Запланированные операции
-- =====================================================
CREATE TABLE scheduled_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly', 'custom')) NOT NULL,
    custom_days INTEGER,
    next_execution_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    note TEXT,
    last_executed_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE scheduled_transactions IS 'Запланированные операции';

-- =====================================================
-- 7. Контакты
-- =====================================================
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    note TEXT,
    avatar_data BYTEA,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE contacts IS 'Контакты для долгов';

-- =====================================================
-- 8. Долги
-- =====================================================
CREATE TABLE debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT NOT NULL,
    type TEXT CHECK (type IN ('iOwe', 'owedToMe')) NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'overdue', 'settled', 'writtenOff')),
    date_taken TIMESTAMPTZ NOT NULL,
    due_date TIMESTAMPTZ,
    settled_date TIMESTAMPTZ,
    purpose TEXT,
    interest_rate REAL,
    is_in_budget BOOLEAN DEFAULT TRUE,
    reminder_days INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE debts IS 'Долги (я должен / должны мне)';

-- =====================================================
-- 9. Платежи по долгам
-- =====================================================
CREATE TABLE debt_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    note TEXT,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE debt_payments IS 'Платежи по долгам';

-- =====================================================
-- 10. Индексы
-- =====================================================
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transfers_user_id ON transfers(user_id);
CREATE INDEX idx_scheduled_user_id ON scheduled_transactions(user_id);
CREATE INDEX idx_scheduled_next_execution ON scheduled_transactions(next_execution_date);
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_debts_user_id ON debts(user_id);
CREATE INDEX idx_debts_contact_id ON debts(contact_id);
CREATE INDEX idx_debt_payments_debt_id ON debt_payments(debt_id);

-- =====================================================
-- 11. Триггер: профиль при регистрации
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
    );

    PERFORM public.init_system_categories(NEW.id);

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 12. Обновление updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER transfers_updated_at BEFORE UPDATE ON transfers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER scheduled_transactions_updated_at BEFORE UPDATE ON scheduled_transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER debts_updated_at BEFORE UPDATE ON debts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER debt_payments_updated_at BEFORE UPDATE ON debt_payments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 13. Row Level Security
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- accounts
CREATE POLICY "Users can view own accounts" ON accounts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON accounts
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON accounts
    FOR DELETE USING (auth.uid() = user_id);

-- categories
CREATE POLICY "Users can view own categories" ON categories
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON categories
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON categories
    FOR DELETE USING (auth.uid() = user_id);

-- transactions
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions
    FOR DELETE USING (auth.uid() = user_id);

-- transfers
CREATE POLICY "Users can view own transfers" ON transfers
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transfers" ON transfers
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transfers" ON transfers
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transfers" ON transfers
    FOR DELETE USING (auth.uid() = user_id);

-- scheduled_transactions
CREATE POLICY "Users can view own scheduled" ON scheduled_transactions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scheduled" ON scheduled_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scheduled" ON scheduled_transactions
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scheduled" ON scheduled_transactions
    FOR DELETE USING (auth.uid() = user_id);

-- contacts
CREATE POLICY "Users can view own contacts" ON contacts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contacts" ON contacts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contacts" ON contacts
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contacts" ON contacts
    FOR DELETE USING (auth.uid() = user_id);

-- debts
CREATE POLICY "Users can view own debts" ON debts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own debts" ON debts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts" ON debts
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts" ON debts
    FOR DELETE USING (auth.uid() = user_id);

-- debt_payments (через связь с debts)
CREATE POLICY "Users can view own debt payments" ON debt_payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM debts
            WHERE debts.id = debt_payments.debt_id
            AND debts.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert own debt payments" ON debt_payments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM debts
            WHERE debts.id = debt_payments.debt_id
            AND debts.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can update own debt payments" ON debt_payments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM debts
            WHERE debts.id = debt_payments.debt_id
            AND debts.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can delete own debt payments" ON debt_payments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM debts
            WHERE debts.id = debt_payments.debt_id
            AND debts.user_id = auth.uid()
        )
    );
