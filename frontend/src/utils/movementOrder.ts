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

/** Новые дни сверху; внутри дня — в порядке добавления (новое в конце дня) */
export function compareMovements(a: Movement, b: Movement): number {
  const dayA = movementDayKey(a.date)
  const dayB = movementDayKey(b.date)

  if (dayA !== dayB) {
    return dayA < dayB ? 1 : -1
  }

  return createdTime(a) - createdTime(b)
}

/** Копия списка, отсортированная по compareMovements */
export function sortMovements<T extends Movement>(items: T[]): T[] {
  return [...items].sort(compareMovements)
}
