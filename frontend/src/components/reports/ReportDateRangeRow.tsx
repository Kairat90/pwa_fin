import React from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '../../utils/cn'
import { REPORT_PERIOD_LABELS, ReportPeriodPreset } from '../../utils/reportPeriod'

interface ReportDateRangeRowProps {
  period: ReportPeriodPreset
  customStart: string
  customEnd: string
  onChange: (customStart: string, customEnd: string) => void
  className?: string
}

const dateInputClassName =
  'block w-full max-w-full min-w-0 box-border rounded-md border border-gray-300 dark:border-gray-700 dark:bg-gray-900 px-1 py-1 text-[11px] leading-tight'

/** Строка с датами периода (мобильная версия отчётов) */
export const ReportDateRangeRow: React.FC<ReportDateRangeRowProps> = ({
  period,
  customStart,
  customEnd,
  onChange,
  className
}) => {
  return (
    <div
      className={cn(
        'w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-primary-200 dark:border-primary-800',
        'bg-primary-50/60 dark:bg-primary-900/20 p-2.5',
        className
      )}
    >
      <div className="flex items-center gap-1.5 mb-2 min-w-0">
        <Calendar className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 shrink-0" />
        <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
          {REPORT_PERIOD_LABELS[period]}
        </span>
      </div>

      <div className="flex items-end gap-1 min-w-0">
        <div className="flex-1 min-w-0 basis-0">
          <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">С</label>
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

        <span className="text-[10px] text-gray-400 pb-1 shrink-0">—</span>

        <div className="flex-1 min-w-0 basis-0">
          <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">По</label>
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

/** @deprecated Используйте ReportDateRangeRow */
export const ReportCustomDateRangeRow = ReportDateRangeRow
