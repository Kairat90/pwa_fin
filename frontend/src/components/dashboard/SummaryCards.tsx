import React from 'react'
import { TrendingUp, TrendingDown, Wallet, BarChart3 } from 'lucide-react'
import { cn } from '../../utils/cn'
import { formatCurrency, DEFAULT_CURRENCY } from '../../utils/currency'

interface SummaryCardsProps {
  totalIncome: number
  totalExpense: number
  netFlow: number
  transactionCount: number
  currency?: string
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  totalIncome,
  totalExpense,
  netFlow,
  transactionCount,
  currency = DEFAULT_CURRENCY
}) => {
  const cards = [
    {
      title: 'Доходы',
      value: totalIncome,
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      isCount: false
    },
    {
      title: 'Расходы',
      value: totalExpense,
      icon: TrendingDown,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      isCount: false
    },
    {
      title: 'Чистый поток',
      value: netFlow,
      icon: Wallet,
      color: netFlow >= 0 ? 'text-blue-600' : 'text-red-600',
      bg: netFlow >= 0 ? 'bg-blue-50' : 'bg-red-50',
      border: netFlow >= 0 ? 'border-blue-200' : 'border-red-200',
      isCount: false
    },
    {
      title: 'Транзакций',
      value: transactionCount,
      icon: BarChart3,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      isCount: true
    }
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className={cn(
            'bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow',
            card.border
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">{card.title}</p>
            <div className={cn('p-2 rounded-lg', card.bg)}>
              <card.icon className={cn('w-4 h-4', card.color)} />
            </div>
          </div>
          <p className={cn('text-xl font-bold', card.color)}>
            {card.isCount
              ? card.value.toLocaleString('ru-RU')
              : formatCurrency(card.value as number, currency)}
          </p>
        </div>
      ))}
    </div>
  )
}
