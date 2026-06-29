# Supabase — миграция с Node.js backend

## 1. Создайте проект в [Supabase Dashboard](https://supabase.com/dashboard)

## 2. Выполните SQL-миграции

В **SQL Editor** по порядку (все файлы из `supabase/migrations/`):

1. `20241230_initial_schema.sql`
2. `20241231_functions.sql`
3. `20250101` … `20250111` (по дате в имени файла)
4. **`20250110_security_rls_and_rpc.sql`** — RLS по FK, защита RPC
5. **`20250111_user_settings.sql`** — валюта по умолчанию, удаление аккаунта
6. **`20250112_add_debt_payment_account.sql`** — счёт при погашении долга
7. **`20250113_debt_payment_types.sql`** — погашение / увеличение долга, редактирование и удаление операций

Опционально: `supabase/seed.sql`

## 3. Настройте Auth

- Authentication → Providers → Email: включите
- Для разработки отключите **Confirm email** (Authentication → Settings)

## 4. Переменные окружения фронтенда

```bash
cd frontend
cp .env.example .env
```

Заполните в `frontend/.env` значения из Dashboard → **Settings → API**:

- `VITE_SUPABASE_URL` — Project URL
- `VITE_SUPABASE_ANON_KEY` — anon public key

> Файл `.env` в Git не попадает. Не храните ключи в корне репозитория.

## 5. Запуск

```bash
cd frontend
npm install
npm run dev
```

## Структура

| Было (backend) | Стало (Supabase) |
|----------------|------------------|
| Express routes | `supabase.from()` + RLS |
| Prisma models | PostgreSQL tables |
| Services | SQL functions (RPC) |
| JWT auth | Supabase Auth |
