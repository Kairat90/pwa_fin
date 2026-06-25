import React from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Edit2, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Transaction } from '../../types'
import { formatCurrency } from '../../utils/currency'
import { cn } from '../../utils/cn'

interface TransactionListProps {
  transactions: Transaction[]
  onEdit: (transaction: Transaction) => void
  onDelete: (id: string) => void
  loading?: boolean
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onEdit,
  onDelete,
  loading
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-lg">Нет транзакций</p>
        <p className="text-sm mt-1">Добавьте первую транзакцию</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {transactions.map((transaction) => {
        const amount = Number(transaction.amount)
        const currency = transaction.account?.currency
        const isTransfer = transaction.tags.includes('transfer')

        return (
          <div
            key={transaction.id}
            className="flex items-center justify-between p-4 bg-white rounded-xl border hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                amount > 0 ? 'bg-green-100' : 'bg-red-100'
              )}>
                {amount > 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-green-600" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">
                    {transaction.category?.name || 'Без категории'}
                  </span>
                  {transaction.isScheduled && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full flex-shrink-0">
                      🔄
                    </span>
                  )}
                  {isTransfer && (
                    <span
                      className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full flex-shrink-0"
                      title="Перевод между счетами — не считается доходом или расходом"
                    >
                      ↔ Перевод
                    </span>
                  )}
                  {transaction.isExcludedFromBudget && !isTransfer && (
                    <span
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex-shrink-0"
                      title="Не учитывается в отчётах доходов и расходов"
                    >
                      Вне бюджета
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {transaction.account?.name || 'Счет удален'}
                  {transaction.note && ` • ${transaction.note}`}
                </p>
                {transaction.tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {transaction.tags.map((tag, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
              <div className="text-right">
                <p className={cn(
                  'font-medium',
                  amount > 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {amount > 0 ? '+' : ''}
                  {formatCurrency(amount, currency)}
                </p>
                <p className="text-xs text-gray-400">
                  {format(new Date(transaction.date), 'dd MMM, HH:mm', { locale: ru })}
                </p>
              </div>
              {!isTransfer && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(transaction)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(transaction.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
