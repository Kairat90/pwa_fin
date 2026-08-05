import React from 'react'
import { CategoryBreakdown } from '../../api/supabase'
import { formatCurrency } from '../../utils/currency'
import { cn } from '../../utils/cn'

interface CategoryHorizontalBarsProps {
  data: CategoryBreakdown[]
  type: 'income' | 'expense'
  currency?: string
  onCategoryClick?: (item: CategoryBreakdown) => void
}

const BAR_COLORS = {
  income: '#10B981',
  expense: '#EF4444'
} as const

/** Горизонтальные столбцы: категория, сумма, полоса с процентом */
export const CategoryHorizontalBars: React.FC<CategoryHorizontalBarsProps> = ({
  data,
  type,
  currency = 'KZT',
  onCategoryClick
}) => {
  const barColor = BAR_COLORS[type]
  const clickable = Boolean(onCategoryClick)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500">
        Нет данных за выбранный период
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.map((item) => {
        const width = Math.max(item.percentage, item.percentage > 0 ? 4 : 0)
        const showPercentInside = item.percentage >= 12

        const content = (
          <>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {item.name}
                </span>
                <span className="text-xs text-gray-400 shrink-0">({item.count})</span>
              </div>
              <span
                className={cn(
                  'text-sm font-semibold tabular-nums shrink-0',
                  type === 'income' ? 'text-green-600' : 'text-red-600'
                )}
              >
                {formatCurrency(item.amount, currency)}
              </span>
            </div>

            <div className="relative h-9 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg transition-all duration-500 flex items-center"
                style={{ width: `${width}%`, backgroundColor: barColor }}
              >
                {showPercentInside && (
                  <span className="ml-auto mr-2 text-xs font-semibold text-white drop-shadow-sm">
                    {item.percentage.toFixed(0)}%
                  </span>
                )}
              </div>
              {!showPercentInside && item.percentage > 0 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {item.percentage.toFixed(0)}%
                </span>
              )}
            </div>
          </>
        )

        if (!clickable) {
          return <div key={item.id}>{content}</div>
        }

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onCategoryClick?.(item)}
            className="w-full text-left rounded-xl p-1 -m-1 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}
