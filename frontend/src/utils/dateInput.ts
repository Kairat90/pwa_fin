/**
 * Поля ввода только даты (без времени).
 * При сохранении к выбранной дате подставляется текущее время.
 */

/** Значение для input type="date" (yyyy-MM-dd) */
export function toDateInputValue(date: Date | string = new Date()): string {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Выбранная дата + текущее локальное время → ISO для API */
export function dateInputToIso(dateOnly: string): string {
  const [year, month, day] = dateOnly.split('-').map(Number)
  const now = new Date()

  return new Date(
    year,
    month - 1,
    day,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  ).toISOString()
}

/** Опциональная дата из input type="date" */
export function optionalDateInputToIso(dateOnly?: string | null): string | undefined {
  if (!dateOnly?.trim()) return undefined
  return dateInputToIso(dateOnly)
}
