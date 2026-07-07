import React from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '../../utils/cn'

interface ReportDateRangeRowProps {
  customStart: string
  customEnd: string
  onChange: (customStart: string, customEnd: string) => void
  className?: string
}

const dateFieldClassName =
  'report-date-field w-full min-w-0 box-border rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-900 px-2 py-2 text-sm'

/** Строка выбора произвольного периода (мобильная версия отчётов) */
export const ReportDateRangeRow: React.FC<ReportDateRangeRowProps> = ({
  customStart,
  customEnd,
  onChange,
  className
}) => {
  return (
    <div
      className={cn(
        'w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-primary-200 dark:border-primary-800',
        'bg-primary-50/60 dark:bg-primary-900/20 p-3',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          Выберите период
        </span>
      </div>

      <div className="flex items-end gap-x-1.5 gap-y-0 w-full">
        <div className="flex-1 flex flex-col min-w-0">
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">С</label>
          <input
            type="date"
            value={customStart}
            max={customEnd || undefined}
            onChange={(e) => {
              const nextStart = e.target.value
              const nextEnd = customEnd && customEnd < nextStart ? nextStart : customEnd

              onChange(nextStart, nextEnd)
            }}
            className={dateFieldClassName}
          />
        </div>

        <span className="text-xs text-gray-400 pb-2.5 shrink-0 px-0.5">—</span>

        <div className="flex-1 flex flex-col min-w-0">
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">По</label>
          <input
            type="date"
            value={customEnd}
            min={customStart || undefined}
            onChange={(e) => onChange(customStart, e.target.value)}
            className={dateFieldClassName}
          />
        </div>
      </div>
    </div>
  )
}
