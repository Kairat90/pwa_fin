import React, { useMemo } from 'react'
import { CategoryBreakdown } from '../../api/supabase'
import { Transaction } from '../../types'
import {
  getTransactionsForCategory,
  groupTransactionsByDate
} from '../../utils/categoryBreakdownReport'
import { formatCurrency } from '../../utils/currency'
import { cn } from '../../utils/cn'
import { Modal } from '../ui/Modal'

interface CategoryTransactionsModalProps {
  isOpen: boolean
  onClose: () => void
  category: CategoryBreakdown | null
  transactions: Transaction[]
  type: 'income' | 'expense'
  currency?: string
}

/** Детализация категории: транзакции, сгруппированные по датам */
export const CategoryTransactionsModal: React.FC<CategoryTransactionsModalProps> = ({
  isOpen,
  onClose,
  category,
  transactions,
  type,
  currency = 'KZT'
}) => {
  const groups = useMemo(() => {
    if (!category) {
      return []
    }

    return groupTransactionsByDate(
      getTransactionsForCategory(transactions, type, category.id)
    )
  }, [category, transactions, type])

  if (!category) {
    return null
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={category.name} size="lg" tallMobile>
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            {category.count}{' '}
            {category.count === 1 ? 'операция' : category.count < 5 ? 'операции' : 'операций'} ·{' '}
            {category.percentage.toFixed(0)}%
          </span>
          <span
            className={cn(
              'font-semibold tabular-nums',
              type === 'income' ? 'text-green-600' : 'text-red-600'
            )}
          >
            {formatCurrency(category.amount, currency)}
          </span>
        </div>

        {groups.length === 0 ? (
          <p className="py-8 text-center text-gray-400 dark:text-gray-500">
            Нет операций по этой категории
          </p>
        ) : (
          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
            {groups.map((group) => (
              <section key={group.dateKey}>
                <div className="flex items-center justify-between gap-2 mb-2 sticky top-0 bg-white dark:bg-gray-900 py-1">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {group.label}
                  </h3>
                  <span className="text-xs tabular-nums text-gray-400">
                    {formatCurrency(group.total, currency)}
                  </span>
                </div>
                <ul className="space-y-2">
                  {group.items.map((tx) => (
                    <li
                      key={tx.id}
                      className="flex items-start justify-between gap-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {tx.account?.name || 'Счёт'}
                        </p>
                        {tx.note ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                            {tx.note}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          'text-sm font-semibold tabular-nums shrink-0',
                          type === 'income' ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        {formatCurrency(Math.abs(Number(tx.amount)), currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
