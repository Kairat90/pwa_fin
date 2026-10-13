import { format, parseISO } from 'date-fns'

type Movement = {
  date: string
  createdAt?: string
}

/** Календарный день операции (локальный) — yyyy-MM-dd */
export function movementDayKey(date: string): string {
  return format(parseISO(date), 'yyyy-MM-dd')
}

function createdTime(movement: Movement): number {
  return movement.createdAt ? new Date(movement.createdAt).getTime() : 0
}

/** Сравнение дней: новые дни сверху; 0 — один и тот же день */
function compareDays(a: Movement, b: Movement): number {
  const dayA = movementDayKey(a.date)
  const dayB = movementDayKey(b.date)

  if (dayA === dayB) return 0
  return dayA < dayB ? 1 : -1
}

/** Списки операций: новые дни сверху; внутри дня — недавно добавленные сверху */
export function compareMovements(a: Movement, b: Movement): number {
  return compareDays(a, b) || createdTime(b) - createdTime(a)
}

/** Отчёты и истории: новые дни сверху; внутри дня — в порядке добавления */
export function compareMovementsChronological(a: Movement, b: Movement): number {
  return compareDays(a, b) || createdTime(a) - createdTime(b)
}

/** Копия списка, отсортированная по compareMovements */
export function sortMovements<T extends Movement>(items: T[]): T[] {
  return [...items].sort(compareMovements)
}

/** Копия списка, отсортированная по compareMovementsChronological */
export function sortMovementsChronological<T extends Movement>(items: T[]): T[] {
  return [...items].sort(compareMovementsChronological)
}
