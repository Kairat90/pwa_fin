/**
 * Поля ввода только даты (без времени).
 * Операции привязаны к календарному дню; время в базе — полдень этого дня,
 * чтобы день не «уезжал» при переводе в UTC.
 */

/** Значение для input type="date" (yyyy-MM-dd) */
export function toDateInputValue(date: Date | string = new Date()): string {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Выбранная дата → ISO для API (полдень локального дня) */
export function dateInputToIso(dateOnly: string): string {
  const [year, month, day] = dateOnly.split('-').map(Number)

  return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString()
}

/** Опциональная дата из input type="date" */
export function optionalDateInputToIso(dateOnly?: string | null): string | undefined {
  if (!dateOnly?.trim()) return undefined
  return dateInputToIso(dateOnly)
}
