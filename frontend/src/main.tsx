import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'

declare global {
  interface Window {
    Capacitor?: unknown
  }
}

/**
 * CapacitorHttp копирует navigator.userAgent в headers.
 * Кириллица в UA (название приложения) ломает fetch на Android WebView.
 */
function sanitizeCapacitorUserAgent() {
  if (!window.Capacitor) {
    return
  }

  try {
    const current = navigator.userAgent || ''
    const clean = `${current.replace(/[^\x00-\x7F]/g, '')} FinUchet/1.0`.trim()

    Object.defineProperty(Navigator.prototype, 'userAgent', {
      get() {
        return clean
      },
      configurable: true
    })
  } catch {
    // WebView может запретить переопределение — тогда чистит MainActivity
  }
}

sanitizeCapacitorUserAgent()

/** Автообновление SW: при новой версии перезагружаем вкладку один раз */
if (!window.Capacitor) {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return

      setInterval(() => {
        void registration.update()
      }, 60 * 60 * 1000)
    },
    onNeedRefresh() {
      window.location.reload()
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
