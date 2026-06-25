/** Преобразование snake_case → camelCase для ответов Supabase */

function toCamelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())
}

export function mapKeys<T>(value: unknown, deep = true): T {
  if (value === null || value === undefined) {
    return value as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => mapKeys(item, deep)) as T
  }

  if (typeof value !== 'object' || value instanceof Date) {
    return value as T
  }

  const result: Record<string, unknown> = {}

  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const camelKey = toCamelKey(key)

    if (deep && val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      result[camelKey] = mapKeys(val, deep)
    } else if (deep && Array.isArray(val)) {
      result[camelKey] = val.map((item) => mapKeys(item, deep))
    } else {
      result[camelKey] = val
    }
  }

  return result as T
}

/** Преобразование camelCase → snake_case для запросов к Supabase */
function toSnakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)
}

export function toSnakeCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue

    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[toSnakeKey(key)] = toSnakeCase(value as Record<string, unknown>)
    } else {
      result[toSnakeKey(key)] = value
    }
  }

  return result
}
