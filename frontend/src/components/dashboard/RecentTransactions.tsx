import React from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '../../utils/cn'
import { formatCurrency } from '../../utils/currency'
import { Transaction } from '../../types'
import { TopTransaction } from '../../api/supabase'

type DisplayTransaction = Transaction | TopTransaction

interface RecentTransactionsProps {
  transactions: DisplayTransaction[]
  onViewAll?: () => void
}

function isTopTransaction(t: DisplayTransaction): t is TopTransaction {
  return typeof (t as TopTransaction).category === 'string' || !('accountId' in t)
}

function getAmount(t: DisplayTransaction): number {
  if (isTopTransaction(t)) {
    return -Math.abs(t.amount)
  }
  return Number(t.amount)
}

function getCategoryName(t: DisplayTransaction): string {
  if (isTopTransaction(t)) {
    return t.category || 'Без категории'
  }
  return t.category?.name || 'Без категории'
}

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  transactions,
  onViewAll
}) => {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>Нет транзакций за этот период</p>
      </div>
    )
  }

  return (
    <div>
      <div className="space-y-3">
        {transactions.slice(0, 5).map((transaction) => {
          const amount = getAmount(transaction)
          const isIncome = amount > 0

          return (
            <div
              key={transaction.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  isIncome ? 'bg-green-100' : 'bg-red-100'
                )}>
                  {isIncome ? (
                    <ArrowUpRight className="w-5 h-5 text-green-600" />
                  ) : (
                    <ArrowDownRight className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-800">
                    {getCategoryName(transaction)}
                    {!isTopTransaction(transaction) && transaction.isScheduled && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                        🔄
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    {transaction.note || 'Без описания'} •{' '}
                    {format(new Date(transaction.date), 'dd MMM, HH:mm', { locale: ru })}
                  </p>
                </div>
              </div>
              <p className={cn('font-medium', isIncome ? 'text-green-600' : 'text-red-600')}>
                {isIncome ? '+' : ''}
                {formatCurrency(amount)}
              </p>
            </div>
          )
        })}
      </div>
      {onViewAll && transactions.length > 0 && (
        <button
          onClick={onViewAll}
          className="mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          Показать все →
        </button>
      )}
    </div>
  )
}
