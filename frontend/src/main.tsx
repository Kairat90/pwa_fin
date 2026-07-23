import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'

/** Автообновление SW: при новой версии перезагружаем вкладку один раз */
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
