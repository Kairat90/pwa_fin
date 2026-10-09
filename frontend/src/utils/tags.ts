/**
 * Утилиты для работы с тегами транзакций.
 */

/**
 * Служебный тег: метка перевода или ID перевода (tid:...), нужен только для внутренней логики.
 */
export function isSystemTag(tag: string): boolean {
  return tag === 'transfer' || tag.startsWith('tid:')
}

/**
 * Возвращает теги, которые имеет смысл показывать пользователю.
 */
export function getVisibleTags(tags: string[]): string[] {
  return tags.filter((tag) => !isSystemTag(tag))
}
