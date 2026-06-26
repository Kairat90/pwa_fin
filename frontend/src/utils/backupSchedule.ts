import { differenceInDays, addDays, parseISO, isValid } from 'date-fns'

/** Интервал между бэкапами (дней) */
export const BACKUP_INTERVAL_DAYS = 7

const STORAGE_SETTINGS = 'pwa_fin_backup_settings'
const STORAGE_LAST_BACKUP = 'pwa_fin_last_backup_at'
const STORAGE_SNOOZE_UNTIL = 'pwa_fin_backup_reminder_snooze_until'

export type BackupScheduleSettings = {
  /** Еженедельное напоминание */
  reminderEnabled: boolean
  /** Автосохранение файла при срабатывании напоминания (share на мобильном) */
  autoExport: boolean
}

const DEFAULT_SETTINGS: BackupScheduleSettings = {
  reminderEnabled: true,
  autoExport: false
}

/** Настройки автобэкапа из localStorage */
export function getBackupSettings(): BackupScheduleSettings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS)

    if (!raw) {
      return { ...DEFAULT_SETTINGS }
    }

    const parsed = JSON.parse(raw) as Partial<BackupScheduleSettings>

    return {
      reminderEnabled: parsed.reminderEnabled ?? DEFAULT_SETTINGS.reminderEnabled,
      autoExport: parsed.autoExport ?? DEFAULT_SETTINGS.autoExport
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/** Сохранить настройки автобэкапа */
export function saveBackupSettings(settings: BackupScheduleSettings): void {
  localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings))
}

/** Дата последнего успешного бэкапа */
export function getLastBackupDate(): Date | null {
  const raw = localStorage.getItem(STORAGE_LAST_BACKUP)

  if (!raw) {
    return null
  }

  const date = parseISO(raw)

  return isValid(date) ? date : null
}

/** Отметить успешное создание бэкапа */
export function markBackupCompleted(at: Date = new Date()): void {
  localStorage.setItem(STORAGE_LAST_BACKUP, at.toISOString())
  localStorage.removeItem(STORAGE_SNOOZE_UNTIL)
  window.dispatchEvent(new Event('pwa-fin-backup-completed'))
}

/** Дней с последнего бэкапа (Infinity если бэкапа не было) */
export function daysSinceLastBackup(): number {
  const last = getLastBackupDate()

  if (!last) {
    return Infinity
  }

  return differenceInDays(new Date(), last)
}

/** Пора напомнить о бэкапе */
export function isBackupDue(): boolean {
  return daysSinceLastBackup() >= BACKUP_INTERVAL_DAYS
}

/** Напоминание отложено пользователем */
export function isReminderSnoozed(): boolean {
  const raw = localStorage.getItem(STORAGE_SNOOZE_UNTIL)

  if (!raw) {
    return false
  }

  const until = parseISO(raw)

  if (!isValid(until)) {
    return false
  }

  return new Date() < until
}

/** Отложить напоминание на несколько дней */
export function snoozeBackupReminder(days = 3): void {
  localStorage.setItem(STORAGE_SNOOZE_UNTIL, addDays(new Date(), days).toISOString())
}

/** Нужно ли показывать баннер напоминания */
export function shouldShowBackupReminder(): boolean {
  const settings = getBackupSettings()

  if (!settings.reminderEnabled) {
    return false
  }

  if (isReminderSnoozed()) {
    return false
  }

  return isBackupDue()
}

/** Текст для баннера: сколько дней без бэкапа */
export function getBackupReminderMessage(): string {
  const days = daysSinceLastBackup()

  if (!Number.isFinite(days)) {
    return 'Вы ещё не делали резервную копию. Рекомендуем сохранить данные раз в неделю.'
  }

  if (days >= BACKUP_INTERVAL_DAYS) {
    return `Прошло ${days} дн. с последнего бэкапа. Сделайте резервную копию данных.`
  }

  return 'Пора сделать резервную копию данных.'
}

/** Форматированная дата последнего бэкапа */
export function formatLastBackupLabel(): string {
  const last = getLastBackupDate()

  if (!last) {
    return 'Бэкап ещё не создавался'
  }

  return last.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
