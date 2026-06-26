const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Проверка формата UUID (для безопасной подстановки в фильтры PostgREST) */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/** Экранирование спецсимволов LIKE/ilike: % _ \ */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** Значение в кавычках для строки фильтра PostgREST */
function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * OR-фильтр ilike по нескольким колонкам.
 * Защита от filter injection: кавычки, запятые и точки в поиске не ломают синтаксис.
 */
export function buildIlikeOrFilter(columns: string[], search: string): string | null {
  const trimmed = search.trim()

  if (!trimmed) {
    return null
  }

  const pattern = quotePostgrestValue(`%${escapeIlike(trimmed)}%`)

  return columns.map((column) => `${column}.ilike.${pattern}`).join(',')
}

/** OR-фильтр eq по двум колонкам для одного UUID */
export function buildUuidEqOrFilter(columnA: string, columnB: string, uuid: string): string {
  if (!isUuid(uuid)) {
    throw new Error('Неверный идентификатор')
  }

  return `${columnA}.eq.${uuid},${columnB}.eq.${uuid}`
}
