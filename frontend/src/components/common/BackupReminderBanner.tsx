import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, X, Save } from 'lucide-react'
import { snoozeBackupReminder, getBackupReminderMessage } from '../../utils/backupSchedule'
import { Button } from '../ui/Button'
import { ICON_16 } from '../../utils/iconSize'

interface BackupReminderBannerProps {
  onBackup: () => Promise<void>
  onDismiss: () => void
  loading?: boolean
}

/** Баннер еженедельного напоминания о бэкапе */
export const BackupReminderBanner: React.FC<BackupReminderBannerProps> = ({
  onBackup,
  onDismiss,
  loading = false
}) => {
  const navigate = useNavigate()

  const handleSnooze = () => {
    snoozeBackupReminder(3)
    onDismiss()
  }

  return (
    <div
      className="mb-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-4 shadow-sm"
      role="status"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            Сделайте бэкап
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-200/90 mt-1">
            {getBackupReminderMessage()}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              type="button"
              size="sm"
              loading={loading}
              onClick={() => void onBackup()}
              className="flex items-center gap-1"
            >
              <Save className={ICON_16} />
              Создать бэкап
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigate('/reports')}
            >
              Отчёты
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleSnooze}
            >
              Напомнить через 3 дня
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 text-amber-600 hover:text-amber-800 dark:text-amber-400 rounded-lg shrink-0"
          aria-label="Закрыть"
        >
          <X className={ICON_16} />
        </button>
      </div>
    </div>
  )
}
