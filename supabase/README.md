# Supabase — миграция с Node.js backend

## 1. Создайте проект в [Supabase Dashboard](https://supabase.com/dashboard)

## 2. Выполните SQL-миграции

В **SQL Editor** по порядку:

1. `supabase/migrations/20241230_initial_schema.sql`
2. `supabase/migrations/20241231_functions.sql`
3. `supabase/seed.sql` (опционально)

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
