import { Capacitor } from '@capacitor/core'

/**
 * Запущено внутри APK (Capacitor), а не в браузере.
 * window.Capacitor для этого не годится: @capacitor/core создаёт его и в вебе.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}
