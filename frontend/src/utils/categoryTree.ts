import { Category } from '../types'

/** ID всех потомков категории (для предотвращения циклов) */
export function getDescendantIds(categories: Category[], parentId: string): Set<string> {
  const ids = new Set<string>()

  const walk = (id: string) => {
    categories
      .filter((c) => c.parentId === id)
      .forEach((child) => {
        ids.add(child.id)
        walk(child.id)
      })
  }

  walk(parentId)
  return ids
}

/** Категории, которые можно выбрать как родителя */
export function getParentOptions(
  categories: Category[],
  type: 'income' | 'expense',
  excludeId?: string
): Category[] {
  const exclude = new Set<string>()

  if (excludeId) {
    exclude.add(excludeId)
    getDescendantIds(categories, excludeId).forEach((id) => exclude.add(id))
  }

  return categories
    .filter((c) => c.type === type && !exclude.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}

/** Построение дерева из плоского списка */
export function buildCategoryTree(categories: Category[]): Category[] {
  const map = new Map<string, Category>()

  categories.forEach((c) => map.set(c.id, { ...c, children: [] }))

  const roots: Category[] = []

  map.forEach((cat) => {
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children!.push(cat)
    } else {
      roots.push(cat)
    }
  })

  return roots.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}

/** Дерево → плоский список с глубиной вложенности */
export function flattenCategoryTree(
  nodes: Category[],
  depth = 0
): Array<Category & { depth: number }> {
  const result: Array<Category & { depth: number }> = []
  const sorted = [...nodes].sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  for (const node of sorted) {
    result.push({ ...node, depth })

    if (node.children?.length) {
      result.push(...flattenCategoryTree(node.children, depth + 1))
    }
  }

  return result
}

/** Глубина вложенности категории в иерархии */
export function getCategoryDepth(categories: Category[], categoryId: string): number {
  let depth = 0
  let current = categories.find((c) => c.id === categoryId)

  while (current?.parentId) {
    depth += 1
    current = categories.find((c) => c.id === current!.parentId)
  }

  return depth
}

/** Подпись категории с отступом для select */
export function formatCategoryOptionLabel(category: Category, depth = 0): string {
  const indent = depth > 0 ? `${'— '.repeat(depth)}` : ''
  return `${indent}${category.icon || '📁'} ${category.name}`
}
