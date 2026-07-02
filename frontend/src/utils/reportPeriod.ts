import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear
} from 'date-fns'

export type ReportPeriodPreset = 'day' | 'week' | 'month' | 'year' | 'custom'

export type ReportDateRange = {
  start: Date
  end: Date
}

/** Диапазон дат для пресета отчёта */
export function getReportDateRange(
  preset: ReportPeriodPreset,
  customStart?: Date,
  customEnd?: Date
): ReportDateRange {
  const now = new Date()

  switch (preset) {
    case 'day':
      return { start: startOfDay(now), end: endOfDay(now) }
    case 'week':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 })
      }
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) }
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now) }
    case 'custom':
      return {
        start: startOfDay(customStart ?? now),
        end: endOfDay(customEnd ?? customStart ?? now)
      }
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) }
  }
}

/** yyyy-MM-dd для запросов к API */
export function formatReportDateRange(range: ReportDateRange): { dateFrom: string; dateTo: string } {
  return {
    dateFrom: format(range.start, 'yyyy-MM-dd'),
    dateTo: format(range.end, 'yyyy-MM-dd')
  }
}

export const REPORT_PERIOD_LABELS: Record<ReportPeriodPreset, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
  year: 'Год',
  custom: 'Период'
}
