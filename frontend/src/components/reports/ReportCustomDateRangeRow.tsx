import React from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '../../utils/cn'

interface ReportCustomDateRangeRowProps {
  customStart: string
  customEnd: string
  onChange: (customStart: string, customEnd: string) => void
  className?: string
}

const dateInputClassName =
  'w-full min-w-0 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-900 px-3 py-2.5 text-sm'

/** Строка выбора произвольного периода (мобильная версия отчётов) */
export const ReportCustomDateRangeRow: React.FC<ReportCustomDateRangeRowProps> = ({
  customStart,
  customEnd,
  onChange,
  className
}) => {
  return (
    <div
      className={cn(
        'rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/60 dark:bg-primary-900/20 p-3',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Выберите период</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div className="min-w-0">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">С</label>
          <input
            type="date"
            value={customStart}
            max={customEnd || undefined}
            onChange={(e) => {
              const nextStart = e.target.value
              const nextEnd = customEnd && customEnd < nextStart ? nextStart : customEnd

              onChange(nextStart, nextEnd)
            }}
            className={dateInputClassName}
          />
        </div>

        <span className="text-gray-400 pb-2.5 shrink-0">—</span>

        <div className="min-w-0">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">По</label>
          <input
            type="date"
            value={customEnd}
            min={customStart || undefined}
            onChange={(e) => onChange(customStart, e.target.value)}
            className={dateInputClassName}
          />
        </div>
      </div>
    </div>
  )
}
