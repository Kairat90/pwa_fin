import React from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '../../utils/cn'
import { DateInput } from '../ui/DateInput'

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
        'bg-primary-50/60 dark:bg-primary-950/30 p-3',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2 text-sm font-medium text-primary-800 dark:text-primary-200">
        <Calendar className="w-4 h-4 shrink-0" />
        Произвольный период
      </div>

      <div className="flex items-end gap-x-1.5 gap-y-0 w-full">
        <div className="flex-1 flex flex-col min-w-0">
          <DateInput
            label="С"
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
          <DateInput
            label="По"
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
