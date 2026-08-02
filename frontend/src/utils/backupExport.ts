import { format } from 'date-fns'
import { supabaseApi } from '../api/supabase'
import { markBackupCompleted } from './backupSchedule'
import { writeBackupToFolder } from './backupFolder'

export type BackupExportMethod = 'share' | 'download' | 'directory'

/** Имя файла бэкапа по дате */
export function getBackupFilename(date = new Date()): string {
  return `backup-${format(date, 'yyyy-MM-dd')}.json`
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * Сохраняет JSON бэкапа:
 * 1) выбранная папка (десктоп),
 * 2) Share API (мобильный),
 * 3) скачивание в Downloads.
 */
export async function exportBackupJson(json: string, date = new Date()): Promise<BackupExportMethod> {
  const filename = getBackupFilename(date)
  const blob = new Blob([json], { type: 'application/json' })

  try {
    if (await writeBackupToFolder(filename, blob)) {
      return 'directory'
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error
    }
    // Нет доступа к папке — fallback ниже
  }

  const file = new File([blob], filename, { type: 'application/json' })

  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Бэкап «Финансовый учёт»',
          text: 'Резервная копия данных приложения'
        })

        return 'share'
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error
      }
    }
  }

  downloadBlob(blob, filename)

  return 'download'
}

/** Создать бэкап на сервере и сохранить локально */
export async function createAndExportBackup(): Promise<BackupExportMethod> {
  const json = await supabaseApi.reports.createBackup()
  const method = await exportBackupJson(json)
  markBackupCompleted()

  return method
}

/** Текст toast по способу сохранения */
export function getBackupSuccessMessage(method: BackupExportMethod, auto = false): string {
  const prefix = auto ? 'Автобэкап' : 'Бэкап'

  switch (method) {
    case 'directory':
      return `${prefix} сохранён в выбранную папку`
    case 'share':
      return auto
        ? 'Автобэкап готов — выберите, куда сохранить'
        : 'Бэкап готов — выберите приложение для сохранения'
    case 'download':
      return auto ? 'Автобэкап сохранён в файл' : 'Бэкап сохранён в файл'
    default: {
      const _exhaustive: never = method
      return _exhaustive
    }
  }
}
