import { createClient } from '@supabase/supabase-js'
import { isNativeApp } from './platform'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY')
}

if (/[^\x00-\x7F]/.test(supabaseUrl) || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl)) {
  throw new Error(
    `Некорректный VITE_SUPABASE_URL (нужен https://xxxx.supabase.co без кириллицы): ${supabaseUrl}`
  )
}

/** HTTP headers допускают только ISO-8859-1; кириллица в Android WebView ломает fetch */
function sanitizeHeaderValue(value: string): string {
  let result = ''

  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    result += code <= 255 ? value[i] : '?'
  }

  return result
}

function toSafeHeaders(input?: HeadersInit): Record<string, string> | undefined {
  if (!input) {
    return undefined
  }

  const out: Record<string, string> = {}

  if (input instanceof Headers) {
    input.forEach((value, key) => {
      out[key] = sanitizeHeaderValue(value)
    })
    return out
  }

  if (Array.isArray(input)) {
    for (const [key, value] of input) {
      out[key] = sanitizeHeaderValue(value)
    }
    return out
  }

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) {
      continue
    }

    out[key] = sanitizeHeaderValue(String(value))
  }

  return out
}

/** fetch без кириллицы в headers — обход бага Android WebView / Capacitor */
const safeFetch: typeof fetch = (input, init) => {
  if (!init?.headers) {
    return fetch(input, init)
  }

  return fetch(input, {
    ...init,
    headers: toSafeHeaders(init.headers)
  })
}

const isNative = isNativeApp()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !isNative
  },
  global: {
    fetch: safeFetch
  }
})

const PASSWORD_RECOVERY_FLAG = 'pwa_fin_password_recovery'

function writeRecoveryFlag(value: '1' | null): void {
  try {
    if (value === null) {
      sessionStorage.removeItem(PASSWORD_RECOVERY_FLAG)
      return
    }

    sessionStorage.setItem(PASSWORD_RECOVERY_FLAG, value)
  } catch {
    // sessionStorage может быть закрыт — страница сброса тогда опирается на событие в этой же вкладке
  }
}

/** Слушатель ставится сразу после клиента, чтобы не пропустить PASSWORD_RECOVERY до монтирования страницы */
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    writeRecoveryFlag('1')
  }
})

/** Ссылка из письма уже обменяна на recovery-сессию */
export function hasPasswordRecovery(): boolean {
  try {
    return sessionStorage.getItem(PASSWORD_RECOVERY_FLAG) === '1'
  } catch {
    return false
  }
}

/** Сбрасывает право открыть форму нового пароля */
export function clearPasswordRecovery(): void {
  writeRecoveryFlag(null)
}

export type Database = {
  public: {
    Tables: {
      users: { Row: Record<string, unknown> }
      accounts: { Row: Record<string, unknown> }
      categories: { Row: Record<string, unknown> }
      transactions: { Row: Record<string, unknown> }
      transfers: { Row: Record<string, unknown> }
      scheduled_transactions: { Row: Record<string, unknown> }
      contacts: { Row: Record<string, unknown> }
      debts: { Row: Record<string, unknown> }
      debt_payments: { Row: Record<string, unknown> }
    }
  }
}
