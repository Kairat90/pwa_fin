import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, ChevronRight } from 'lucide-react'
import { supabaseApi } from '../../api/supabase'
import { ScheduledTransaction } from '../../types'
import { formatCurrency } from '../../utils/currency'
import { cn } from '../../utils/cn'
import {
  calendarDaysUntil,
  formatScheduleDate,
  getScheduleRelativeLabel,
  isScheduleOverdue
} from '../../utils/scheduleDate'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { ScheduledExecuteModal } from '../scheduled/ScheduledExecuteModal'
import { ICON_16 } from '../../utils/iconSize'

const FREQUENCY_SHORT: Record<string, string> = {
  daily: 'ежедн.',
  weekly: 'еженед.',
  biweekly: 'раз в 2 нед.',
  monthly: 'ежемес.',
  yearly: 'ежегод.',
  custom: 'своя'
}

interface UpcomingScheduledRowProps {
  item: ScheduledTransaction
  onExecute: (item: ScheduledTransaction) => void
}

/** Строка предстоящей операции */
const UpcomingScheduledRow: React.FC<UpcomingScheduledRowProps> = ({
  item,
  onExecute
}) => {
  const daysUntil = calendarDaysUntil(item.nextExecutionDate)
  const isOverdue = isScheduleOverdue(item.nextExecutionDate)
  const isToday = daysUntil === 0
  const dateLabel = getScheduleRelativeLabel(item.nextExecutionDate)

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border transition-colors',
        isOverdue
          ? 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20'
          : 'border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/30'
      )}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="text-xl shrink-0" aria-hidden>
          {item.type === 'income' ? '💰' : '💸'}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {item.account?.name || 'Счёт'}
            {item.category?.name ? ` · ${item.category.name}` : ''}
            {' · '}
            {FREQUENCY_SHORT[item.frequency] || item.frequency}
          </p>
          <p className="text-sm mt-1 flex items-center gap-1 flex-wrap">
            <span
              className={cn(
                'font-medium',
                isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
              )}
            >
              {formatScheduleDate(item.nextExecutionDate)}
            </span>
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                isOverdue
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                  : isToday
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              )}
            >
              {dateLabel}
            </span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 sm:shrink-0">
        <p
          className={cn(
            'font-bold text-lg',
            item.type === 'income' ? 'text-green-600' : 'text-red-600'
          )}
        >
          {item.type === 'income' ? '+' : '−'}
          {formatCurrency(Number(item.amount), item.account?.currency)}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onExecute(item)}
          className="whitespace-nowrap"
        >
          Выполнить сейчас
        </Button>
      </div>
    </div>
  )
}

/** Блок «Скоро к оплате» — автопланировщик на дашборде */
export const UpcomingScheduledBlock: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [executeItem, setExecuteItem] = useState<ScheduledTransaction | null>(null)

  const { data: items, isLoading } = useQuery({
    queryKey: ['scheduled', 'upcoming', 7],
    queryFn: () => supabaseApi.scheduled.getUpcoming(7)
  })

  const invalidateAfterExecute = () => {
    queryClient.invalidateQueries({ queryKey: ['scheduled'] })
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    queryClient.invalidateQueries({ queryKey: ['summary'] })
    queryClient.invalidateQueries({ queryKey: ['totalBalance'] })
    queryClient.invalidateQueries({ queryKey: ['topTransactions'] })
  }

  const upcoming = items ?? []
  const overdueCount = upcoming.filter((item) => isScheduleOverdue(item.nextExecutionDate)).length

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock className={cn(ICON_16, 'text-primary-600 dark:text-primary-400')} />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Скоро к оплате
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Запланированные операции на 7 дней
              {overdueCount > 0 && (
                <span className="text-red-600 dark:text-red-400 ml-1">
                  · {overdueCount} просрочено
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/scheduled')}
          className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 shrink-0"
        >
          Планировщик
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      )}

      {!isLoading && upcoming.length === 0 && (
        <div className="text-center py-8 px-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">
            Нет операций на ближайшие 7 дней
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => navigate('/scheduled')}
          >
            Создать в планировщике
          </Button>
        </div>
      )}

      {!isLoading && upcoming.length > 0 && (
        <div className="space-y-3">
          {upcoming.map((item) => (
            <UpcomingScheduledRow
              key={item.id}
              item={item}
              onExecute={setExecuteItem}
            />
          ))}
        </div>
      )}

      <ScheduledExecuteModal
        isOpen={Boolean(executeItem)}
        onClose={() => setExecuteItem(null)}
        onSuccess={invalidateAfterExecute}
        scheduled={executeItem}
      />
    </Card>
  )
}
