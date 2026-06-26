import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../api/supabase'
import { createAndExportBackup } from '../utils/backupExport'
import {
  getBackupSettings,
  isBackupDue,
  shouldShowBackupReminder
} from '../utils/backupSchedule'

const SESSION_AUTO_KEY = 'pwa_fin_auto_backup_session'
const SESSION_DISMISS_KEY = 'pwa_fin_backup_banner_dismissed'

/**
 * Планировщик автобэкапа: баннер-напоминание и опциональный автовывод файла при входе.
 */
export function useBackupScheduler(isAuthenticated: boolean) {
  const [showReminder, setShowReminder] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)

  const refreshReminder = useCallback(() => {
    if (sessionStorage.getItem(SESSION_DISMISS_KEY)) {
      setShowReminder(false)
      return
    }

    setShowReminder(isAuthenticated && shouldShowBackupReminder())
  }, [isAuthenticated])

  useEffect(() => {
    refreshReminder()

    const onBackupEvent = () => refreshReminder()
    window.addEventListener('pwa-fin-backup-completed', onBackupEvent)

    return () => window.removeEventListener('pwa-fin-backup-completed', onBackupEvent)
  }, [refreshReminder])

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    const settings = getBackupSettings()

    if (!settings.reminderEnabled || !settings.autoExport || !isBackupDue()) {
      return
    }

    if (sessionStorage.getItem(SESSION_AUTO_KEY)) {
      return
    }

    sessionStorage.setItem(SESSION_AUTO_KEY, '1')

    const runAutoBackup = async () => {
      try {
        setBackupLoading(true)
        const method = await createAndExportBackup()
        toast.success(
          method === 'share'
            ? 'Автобэкап готов — выберите, куда сохранить'
            : 'Автобэкап сохранён в файл'
        )
        sessionStorage.removeItem(SESSION_DISMISS_KEY)
        setShowReminder(false)
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          setShowReminder(true)
          return
        }

        toast.error(getErrorMessage(error) || 'Не удалось создать автобэкап')
        setShowReminder(true)
      } finally {
        setBackupLoading(false)
      }
    }

    void runAutoBackup()
  }, [isAuthenticated])

  const dismissReminder = useCallback(() => {
    sessionStorage.setItem(SESSION_DISMISS_KEY, '1')
    setShowReminder(false)
  }, [])

  const runBackup = useCallback(async () => {
    try {
      setBackupLoading(true)
      const method = await createAndExportBackup()
      sessionStorage.removeItem(SESSION_DISMISS_KEY)
      toast.success(
        method === 'share' ? 'Бэкап готов — выберите приложение для сохранения' : 'Бэкап сохранён'
      )
      setShowReminder(false)
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      toast.error(getErrorMessage(error) || 'Ошибка создания бэкапа')
      throw error
    } finally {
      setBackupLoading(false)
    }
  }, [])

  return {
    showReminder,
    backupLoading,
    refreshReminder,
    dismissReminder,
    runBackup
  }
}
