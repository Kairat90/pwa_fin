# Capacitor Android

Проект подготовлен к интеграции `Capacitor`.

## Что уже добавлено

- `capacitor.config.ts`
- npm-скрипты для `cap sync` и Android
- отключение `service worker` внутри native WebView

## Что нужно установить

Выполнить в `frontend/`:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

## Первый запуск Android

```bash
npm run android:add
npm run android:sync
npm run android:open
```

Дальше в Android Studio:

1. дождаться Gradle sync
2. выбрать эмулятор или телефон
3. `Run`

## После изменений во фронтенде

```bash
npm run android:sync
```

Если уже открыт Android Studio, после `sync` можно собирать APK/AAB из Android-проекта.

## Сборка APK

В Android Studio:

`Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`

## Важно

- Native-оболочка использует `dist/`
- PWA `service worker` в Capacitor-режиме отключён специально, чтобы не ловить старый кэш внутри Android WebView
- Переменные `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` должны быть доступны при `npm run build`
- `CapacitorHttp` **включён** — иначе WebView CORS (`https://localhost`) даёт `Failed to fetch`
- User-Agent очищается от кириллицы в `MainActivity` и `main.tsx` (иначе `non ISO-8859-1`)
- `appName` в конфиге — ASCII `FinUchet`
- `vite build` падает, если нет `VITE_SUPABASE_*` в `.env` или URL с кириллицей (иначе APK резолвит `xn--….supabase.co`)

## Пересборка после правок сети/авторизации

Проверьте `frontend/.env` — URL только латиницей, например:
`VITE_SUPABASE_URL=https://rkshieajywftahjgoxfa.supabase.co`

Затем из `frontend/`:

```bash
npm run android:sync
```

Затем в Android Studio: **Build → Build APK(s)** и переустановите приложение.
