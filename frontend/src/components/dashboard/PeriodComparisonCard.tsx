import React from 'react'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { ComparisonReport } from '../../api/supabase'
import { formatCurrency } from '../../utils/currency'
import { cn } from '../../utils/cn'
import { ICON_16 } from '../../utils/iconSize'
import { ComparisonChart } from '../reports/ComparisonChart'

interface PeriodComparisonCardProps {
  data: ComparisonReport
  currency: string
  periodLabel?: string
}

/** Форматирует процент изменения */
function formatChange(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export const PeriodComparisonCard: React.FC<PeriodComparisonCardProps> = ({
  data,
  currency,
  periodLabel = 'к прошлому периоду'
}) => {
  const items = [
    {
      label: 'Доходы',
      current: data.current.totalIncome,
      change: data.changes.income,
      positiveIsGood: true,
      icon: TrendingUp
    },
    {
      label: 'Расходы',
      current: data.current.totalExpense,
      change: data.changes.expense,
      positiveIsGood: false,
      icon: TrendingDown
    },
    {
      label: 'Чистый поток',
      current: data.current.netFlow,
      change: data.changes.netFlow,
      positiveIsGood: true,
      icon: Minus
    }
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map(({ label, current, change, positiveIsGood, icon: Icon }) => {
          const isGood = positiveIsGood ? change >= 0 : change <= 0

          return (
            <div key={label} className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <Icon className={ICON_16} />
                {label}
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(current, currency)}
              </p>
              <p className={cn(
                'text-xs font-medium mt-1',
                change === 0 ? 'text-gray-500' : isGood ? 'text-green-600' : 'text-red-600'
              )}>
                {formatChange(change)} {periodLabel}
              </p>
            </div>
          )
        })}
      </div>
      <ComparisonChart data={data} />
    </div>
  )
}
