/** Человекочитаемое описание устройства по User-Agent */
export function formatSessionDeviceLabel(userAgent: string | null | undefined): string {
  if (!userAgent?.trim()) {
    return 'Неизвестное устройство'
  }

  const ua = userAgent

  const browser =
    /Edg\//.test(ua)
      ? 'Edge'
      : /Chrome\//.test(ua) && !/Chromium\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua) && !/Chrome\//.test(ua)
            ? 'Safari'
            : /FinUchet/.test(ua) || /Capacitor/i.test(ua)
              ? 'Приложение'
              : 'Браузер'

  const os =
    /Android/i.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/i.test(ua)
        ? 'iOS'
        : /Windows/i.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/i.test(ua)
            ? 'macOS'
            : /Linux/i.test(ua)
              ? 'Linux'
              : null

  return os ? `${browser} · ${os}` : browser
}

/** Короткий IP для отображения */
export function formatSessionIp(ip: string | null | undefined): string | null {
  if (!ip?.trim()) {
    return null
  }

  return ip.trim()
}
