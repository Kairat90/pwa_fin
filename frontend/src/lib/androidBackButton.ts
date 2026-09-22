import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

/**
 * На Android кнопка «Назад» должна идти в history (закрытие модалок),
 * а не сразу закрывать приложение.
 */
export async function initAndroidBackButton(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back()
      return
    }

    void App.exitApp()
  })
}
