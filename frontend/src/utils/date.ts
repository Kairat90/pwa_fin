import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ru } from 'date-fns/locale'

export function formatDate(date: string | Date, pattern = 'dd.MM.yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, pattern, { locale: ru })
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'dd.MM.yyyy HH:mm')
}

export function getCurrentMonthRange() {
  const now = new Date()
  return {
    startDate: startOfMonth(now).toISOString(),
    endDate: endOfMonth(now).toISOString()
  }
}

export function getPreviousMonthRange() {
  const prev = subMonths(new Date(), 1)
  return {
    startDate: startOfMonth(prev).toISOString(),
    endDate: endOfMonth(prev).toISOString()
  }
}

export function toInputDate(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd')
}
