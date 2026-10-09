import { App } from '@capacitor/app'
import { isNativeApp } from './platform'

/**
 * На Android кнопка «Назад» должна идти в history (закрытие модалок),
 * а не сразу закрывать приложение.
 */
export async function initAndroidBackButton(): Promise<void> {
  if (!isNativeApp()) {
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
