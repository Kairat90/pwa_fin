import {
  differenceInCalendarDays,
  format,
  isToday,
  isTomorrow,
  isValid,
  parseISO,
  startOfDay
} from 'date-fns'
import { ru } from 'date-fns/locale'

/** Дата для планировщика → ISO (полдень локального дня, без сдвига UTC) */
export function scheduledDateToIso(dateOnly: string): string {
  const [year, month, day] = dateOnly.split('-').map(Number)

  return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString()
}

export function optionalScheduledDateToIso(dateOnly?: string | null): string | undefined {
  if (!dateOnly?.trim()) {
    return undefined
  }

  return scheduledDateToIso(dateOnly)
}

function toLocalDate(value: Date | string): Date {
  return typeof value === 'string' ? parseISO(value) : value
}

/** Календарных дней от сегодня до даты (положительное — в будущем) */
export function calendarDaysUntil(value: Date | string): number {
  const date = toLocalDate(value)

  if (!isValid(date)) {
    return 0
  }

  return differenceInCalendarDays(startOfDay(date), startOfDay(new Date()))
}

/** Подпись «сегодня / завтра / через N дн.» для даты планировщика */
export function getScheduleRelativeLabel(value: Date | string): string {
  const date = toLocalDate(value)

  if (!isValid(date)) {
    return ''
  }

  if (isToday(date)) {
    return 'сегодня'
  }

  if (isTomorrow(date)) {
    return 'завтра'
  }

  const days = calendarDaysUntil(date)

  if (days > 1) {
    return `через ${days} дн.`
  }

  if (days < -1) {
    return `просрочено на ${Math.abs(days)} дн.`
  }

  return 'вчера'
}

export function formatScheduleDate(value: Date | string): string {
  const date = toLocalDate(value)

  if (!isValid(date)) {
    return ''
  }

  return format(date, 'dd MMM yyyy', { locale: ru })
}

export function isScheduleOverdue(value: Date | string): boolean {
  return calendarDaysUntil(value) < 0
}
