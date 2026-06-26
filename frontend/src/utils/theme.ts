/** Режим темы приложения */
export type ThemeMode = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'pwa-fin-theme'

const VALID_MODES: ThemeMode[] = ['light', 'dark', 'system']

/** Читает сохранённый режим темы */
export function readStoredTheme(): ThemeMode {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    if (value && VALID_MODES.includes(value as ThemeMode)) {
      return value as ThemeMode
    }
  } catch {
    // localStorage недоступен
  }
  return 'system'
}

/** Сохраняет режим темы */
export function storeTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // ignore
  }
}

/** Системная тема ОС */
export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Итоговая тема для применения класса dark */
export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemTheme() : mode
}

/** Применяет тему к document и meta theme-color (PWA) */
export function applyResolvedTheme(resolved: 'light' | 'dark'): void {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? '#111827' : '#4F46E5')
  }
}

/** Применяет режим (light / dark / system) */
export function applyThemeMode(mode: ThemeMode): 'light' | 'dark' {
  const resolved = resolveTheme(mode)
  applyResolvedTheme(resolved)
  return resolved
}

export const THEME_OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
  { value: 'light', label: 'Светлая', description: 'Всегда светлый интерфейс' },
  { value: 'dark', label: 'Тёмная', description: 'Всегда тёмный интерфейс' },
  { value: 'system', label: 'Системная', description: 'Как в настройках телефона или ОС' }
]
