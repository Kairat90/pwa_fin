import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { CategoryBreakdown } from '../api/supabase'
import { Transaction } from '../types'

/** Транзакции, попадающие в отчёт по типу (как в get_category_breakdown) */
export function filterTransactionsByReportType(
  transactions: Transaction[],
  type: 'income' | 'expense'
): Transaction[] {
  return transactions.filter((t) => {
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
}

/** Агрегация транзакций по категориям (логика как в get_category_breakdown) */
export function buildCategoryBreakdown(
  transactions: Transaction[],
  type: 'income' | 'expense'
): CategoryBreakdown[] {
  const filtered = filterTransactionsByReportType(transactions, type)
  const byCategory = new Map<string, Omit<CategoryBreakdown, 'percentage'>>()

  for (const transaction of filtered) {
    const category = transaction.category
    const id = category?.id ?? 'uncategorized'
    const row = byCategory.get(id) ?? {
      id,
      name: category?.name ?? 'Без категории',
      icon: '',
      color: '',
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

/** Транзакции одной категории в рамках отчёта */
export function getTransactionsForCategory(
  transactions: Transaction[],
  type: 'income' | 'expense',
  categoryId: string
): Transaction[] {
  return filterTransactionsByReportType(transactions, type)
    .filter((t) => (t.category?.id ?? 'uncategorized') === categoryId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export type TransactionDateGroup = {
  dateKey: string
  label: string
  items: Transaction[]
  total: number
}

/** Группировка транзакций по календарному дню (новые даты сверху) */
export function groupTransactionsByDate(transactions: Transaction[]): TransactionDateGroup[] {
  const map = new Map<string, Transaction[]>()

  for (const transaction of transactions) {
    const dateKey = format(parseISO(transaction.date), 'yyyy-MM-dd')
    const list = map.get(dateKey) ?? []
    list.push(transaction)
    map.set(dateKey, list)
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dateKey, items]) => {
      const sorted = [...items].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )

      return {
        dateKey,
        label: format(parseISO(dateKey), 'd MMMM yyyy', { locale: ru }),
        items: sorted,
        total: sorted.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)
      }
    })
}
