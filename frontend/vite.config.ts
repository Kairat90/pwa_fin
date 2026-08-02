import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  const out: Record<string, string> = {}
  const text = fs.readFileSync(filePath, 'utf8')

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '').trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const eq = line.indexOf('=')
    if (eq <= 0) {
      continue
    }

    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    out[key] = value
  }

  return out
}

function assertSupabaseEnv(env: Record<string, string>) {
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Нет VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Создайте frontend/.env перед npm run build / android:sync'
    )
  }

  // Кириллица в hostname → punycode xn--… и «Unable to resolve host» на Android
  if (/[^\x00-\x7F]/.test(url) || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
    throw new Error(
      `VITE_SUPABASE_URL должен быть вида https://xxxx.supabase.co (только латиница). Сейчас: ${url}\n` +
        'Проверьте frontend/.env и удалите системную переменную Windows VITE_SUPABASE_URL, если она задана (set VITE_SUPABASE).'
    )
  }

  if (/[^\x00-\x7F]/.test(key) || key.length < 40) {
    throw new Error('VITE_SUPABASE_ANON_KEY выглядит как заглушка — вставьте anon key из Supabase Dashboard')
  }
}

export default defineConfig(({ mode }) => {
  const root = process.cwd()
  // loadEnv: process.env перекрывает файлы; мы снова накладываем fromFiles сверху
  const fromProcess = loadEnv(mode, root, '')
  // При build (mode=production) .env.production перекрывает .env — там не должно быть «ваш-проект»
  const fromFiles = {
    ...readEnvFile(path.join(root, '.env')),
    ...readEnvFile(path.join(root, `.env.${mode}`)),
    ...readEnvFile(path.join(root, '.env.local')),
    ...readEnvFile(path.join(root, `.env.${mode}.local`))
  }
  const env = { ...fromProcess, ...fromFiles }

  assertSupabaseEnv(env)

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon-192x192.png', 'icon-512x512.png', 'maskable-icon.png'],
        manifest: {
          name: 'Финансовый учет',
          short_name: 'Учет',
          description: 'Приложение для учета расходов и доходов',
          theme_color: '#4F46E5',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'maskable-icon.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api/],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.hostname.endsWith('supabase.co'),
              handler: 'NetworkOnly'
            }
          ]
        }
      })
    ],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY)
    },
    server: {
      port: 5173
    }
  }
})
