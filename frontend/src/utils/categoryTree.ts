import { Category } from '../types'

/** Сравнение категорий по sort_order, затем по имени */
export function compareCategories(a: Category, b: Category): number {
  const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  if (orderDiff !== 0) return orderDiff
  return a.name.localeCompare(b.name, 'ru')
}

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
    .sort(compareCategories)
}

/** Построение дерева из плоского списка */
export function buildCategoryTree(categories: Category[]): Category[] {
  const map = new Map<string, Category>()

  categories.forEach((c) => map.set(c.id, { ...c, children: [] }))

  const roots: Category[] = []

  map.forEach((cat) => {
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children!.push(cat)
    } else if (!cat.parentId) {
      roots.push(cat)
    } else {
      roots.push(cat)
    }
  })

  const sortNodes = (nodes: Category[]): Category[] => {
    nodes.sort(compareCategories)
    nodes.forEach((n) => {
      if (n.children?.length) {
        n.children = sortNodes(n.children)
      }
    })
    return nodes
  }

  return sortNodes(roots)
}

/** Дерево → плоский список с глубиной вложенности */
export function flattenCategoryTree(
  nodes: Category[],
  depth = 0
): Array<Category & { depth: number }> {
  const result: Array<Category & { depth: number }> = []
  const sorted = [...nodes].sort(compareCategories)

  for (const node of sorted) {
    result.push({ ...node, depth })

    if (node.children?.length) {
      result.push(...flattenCategoryTree(node.children, depth + 1))
    }
  }

  return result
}

/** Разделить на доходы и расходы (системные — в конце колонки) */
export function splitCategoriesByType(categories: Category[]): {
  income: Array<Category & { depth: number }>
  expense: Array<Category & { depth: number }>
} {
  const userCats = categories.filter((c) => !c.isSystem)
  const systemCats = categories.filter((c) => c.isSystem)

  const incomeUser = flattenCategoryTree(
    buildCategoryTree(userCats.filter((c) => c.type === 'income'))
  )
  const expenseUser = flattenCategoryTree(
    buildCategoryTree(userCats.filter((c) => c.type === 'expense'))
  )

  const incomeSystem = flattenCategoryTree(
    buildCategoryTree(systemCats.filter((c) => c.type === 'income'))
  )
  const expenseSystem = flattenCategoryTree(
    buildCategoryTree(systemCats.filter((c) => c.type === 'expense'))
  )

  return {
    income: [...incomeUser, ...incomeSystem],
    expense: [...expenseUser, ...expenseSystem]
  }
}

/** Можно ли переместить категорию вверх/вниз среди соседей */
export function getSiblingMoveFlags(
  categories: Category[],
  categoryId: string
): { canMoveUp: boolean; canMoveDown: boolean } {
  const current = categories.find((c) => c.id === categoryId)
  if (!current || current.isSystem) {
    return { canMoveUp: false, canMoveDown: false }
  }

  const siblings = categories
    .filter(
      (c) =>
        !c.isSystem &&
        c.type === current.type &&
        (c.parentId ?? null) === (current.parentId ?? null)
    )
    .sort(compareCategories)

  const index = siblings.findIndex((c) => c.id === categoryId)

  return {
    canMoveUp: index > 0,
    canMoveDown: index >= 0 && index < siblings.length - 1
  }
}

/** Следующий sort_order для новой категории */
export function getNextSortOrder(
  categories: Category[],
  type: 'income' | 'expense',
  parentId?: string | null
): number {
  const siblings = categories.filter(
    (c) => c.type === type && (c.parentId ?? null) === (parentId ?? null) && !c.isSystem
  )

  if (siblings.length === 0) return 0

  return Math.max(...siblings.map((c) => c.sortOrder ?? 0)) + 1
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
