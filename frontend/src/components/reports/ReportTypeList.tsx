import React from 'react'
import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '../../utils/cn'

export type ReportTypeId = 'income-categories' | 'expense-categories' | 'overview'

export const REPORT_TYPES: {
  id: ReportTypeId
  title: string
  icon: React.ElementType
}[] = [
  { id: 'income-categories', title: 'Доходы по категориям', icon: TrendingUp },
  { id: 'expense-categories', title: 'Расходы по категориям', icon: TrendingDown },
  { id: 'overview', title: 'Сводка', icon: BarChart3 }
]

interface ReportTypeListProps {
  activeId: ReportTypeId
  onChange: (id: ReportTypeId) => void
}

/** Список доступных отчётов */
export const ReportTypeList: React.FC<ReportTypeListProps> = ({ activeId, onChange }) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
      {REPORT_TYPES.map((report) => {
        const Icon = report.icon
        const isActive = activeId === report.id

        return (
          <button
            key={report.id}
            type="button"
            onClick={() => onChange(report.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium whitespace-nowrap transition-colors shrink-0',
              isActive
                ? 'border-primary-500 bg-primary-50 text-primary-800 dark:bg-primary-900/30 dark:text-primary-200 shadow-sm'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {report.title}
          </button>
        )
      })}
    </div>
  )
}
