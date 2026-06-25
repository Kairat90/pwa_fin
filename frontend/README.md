# Финансовый учёт — PWA

React + Vite + TypeScript + Tailwind + Supabase.

## Структура репозитория

| Папка | Назначение |
|-------|------------|
| `frontend/` | PWA-приложение (деплой на Vercel) |
| `supabase/` | SQL-миграции и функции БД |

## Деплой на Vercel

### 1. Подготовка

1. Зарегистрируйтесь на [Vercel](https://vercel.com)
2. Убедитесь, что Supabase настроен (схема, RLS, `functions.sql`)
3. Скопируйте из Supabase Dashboard → **Settings → API**:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

### 2. Переменные окружения

Для локальной production-сборки отредактируйте `frontend/.env.production`.

На Vercel переменные задаются в **Project → Settings → Environment Variables** (для Production, Preview, Development):

| Переменная | Пример |
|------------|--------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` |

> Не коммитьте реальные ключи в Git. Файл `.env` и `.env.production` с секретами держите локально.

### 3. Supabase Auth (обязательно после деплоя)

В Supabase Dashboard → **Authentication → URL Configuration** добавьте:

- **Site URL**: `https://ваш-домен.vercel.app`
- **Redirect URLs**: `https://ваш-домен.vercel.app/**`

### 4. Деплой через CLI

```bash
npm i -g vercel
cd frontend
vercel
```

При первом запуске:

- подтвердите проект;
- **Root Directory**: `frontend` (если деплой из корня монорепо);
- добавьте переменные окружения;
- для production: `vercel --prod`

### 5. Деплой через GitHub (рекомендуется)

1. Загрузите код в GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/ваш-username/pwa-fin.git
git push -u origin main
```

2. Vercel → **Add New → Project** → выберите репозиторий
3. **Root Directory**: `frontend`
4. **Framework Preset**: Vite (подтянется из `vercel.json`)
5. Добавьте `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`
6. **Deploy**

### 6. Проверка после деплоя

- [ ] Открывается главная страница (SPA, без 404 на `/accounts`)
- [ ] Регистрация и вход работают
- [ ] Создание счёта и транзакции сохраняются в Supabase
- [ ] PWA: иконка и установка на устройство (Chrome → «Установить приложение»)

## Локальная разработка

```bash
cd frontend
cp .env.example .env
# заполните VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## Сборка

```bash
cd frontend
npm run build
npm run preview
```

## Файлы конфигурации Vercel

- `vercel.json` — SPA rewrites, security headers, кэш PWA
- `package.json` → скрипт `vercel-build` для сборки на Vercel
