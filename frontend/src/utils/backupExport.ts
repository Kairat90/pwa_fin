import { format } from 'date-fns'
import { supabaseApi } from '../api/supabase'
import { markBackupCompleted } from './backupSchedule'

export type BackupExportMethod = 'share' | 'download'

/** Имя файла бэкапа по дате */
export function getBackupFilename(date = new Date()): string {
  return `backup-${format(date, 'yyyy-MM-dd')}.json`
}

/**
 * Сохраняет JSON бэкапа: на мобильном — Web Share API, иначе — скачивание файла.
 */
export async function exportBackupJson(json: string, date = new Date()): Promise<BackupExportMethod> {
  const filename = getBackupFilename(date)
  const blob = new Blob([json], { type: 'application/json' })
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

  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)

  return 'download'
}

/** Создать бэкап на сервере и сохранить локально */
export async function createAndExportBackup(): Promise<BackupExportMethod> {
  const json = await supabaseApi.reports.createBackup()
  const method = await exportBackupJson(json)
  markBackupCompleted()

  return method
}
