import { CategoryBreakdown } from '../api/supabase'
import { Transaction } from '../types'

/** Агрегация транзакций по категориям (логика как в get_category_breakdown) */
export function buildCategoryBreakdown(
  transactions: Transaction[],
  type: 'income' | 'expense'
): CategoryBreakdown[] {
  const filtered = transactions.filter((t) => {
    if (t.isExcludedFromBudget) {
      return false
    }

    const category = t.category

    if (type === 'income') {
      if (t.amount <= 0) {
        return false
      }

      return !category || category.type === 'income'
    }

    if (t.amount >= 0) {
      return false
    }

    return !category || category.type === 'expense'
  })

  const byCategory = new Map<string, Omit<CategoryBreakdown, 'percentage'>>()

  for (const transaction of filtered) {
    const category = transaction.category
    const id = category?.id ?? 'uncategorized'
    const row = byCategory.get(id) ?? {
      id,
      name: category?.name ?? 'Без категории',
      icon: category?.icon ?? '',
      color: category?.color ?? '#6B7280',
      amount: 0,
      count: 0
    }

    row.amount += Math.abs(Number(transaction.amount))
    row.count += 1
    byCategory.set(id, row)
  }

  const items = Array.from(byCategory.values()).sort((a, b) => b.amount - a.amount)
  const total = items.reduce((sum, item) => sum + item.amount, 0)

  return items.map((item) => ({
    ...item,
    percentage: total > 0 ? (item.amount / total) * 100 : 0
  }))
}
