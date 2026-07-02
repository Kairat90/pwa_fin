import React, { useState } from 'react'
import { format, differenceInDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Edit2, Trash2, Play, SkipForward, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { ScheduledTransaction } from '../../types'
import { supabaseApi, getErrorMessage } from '../../api/supabase'
import { formatCurrency } from '../../utils/currency'
import { cn } from '../../utils/cn'
import { EMOJI_BOX_16, ICON_16 } from '../../utils/iconSize'
import { ScheduledExecuteModal } from './ScheduledExecuteModal'

interface ScheduledCardProps {
  scheduled: ScheduledTransaction
  onEdit: (scheduled: ScheduledTransaction) => void
  onDelete: (id: string) => void
  onSuccess: () => void
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Ежедневно',
  weekly: 'Еженедельно',
  biweekly: 'Раз в 2 недели',
  monthly: 'Ежемесячно',
  yearly: 'Ежегодно',
  custom: 'Своя периодичность'
}

export const ScheduledCard: React.FC<ScheduledCardProps> = ({
  scheduled,
  onEdit,
  onDelete,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false)
  const [showExecuteModal, setShowExecuteModal] = useState(false)

  const daysUntilNext = differenceInDays(
    new Date(scheduled.nextExecutionDate),
    new Date()
  )

  const handleSkip = async () => {
    try {
      setLoading(true)
      await supabaseApi.scheduled.skip(scheduled.id)
      toast.success('Выполнение пропущено')
      onSuccess()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const frequencyLabel = FREQUENCY_LABELS[scheduled.frequency] || scheduled.frequency
  const daysText = daysUntilNext > 0
    ? `через ${daysUntilNext} дн.`
    : daysUntilNext === 0
      ? 'сегодня'
      : `просрочено на ${Math.abs(daysUntilNext)} дн.`

  return (
    <>
      <div className={cn(
        'bg-white rounded-xl border p-5 shadow-sm hover:shadow-md transition-all',
        !scheduled.isActive && 'opacity-60',
        daysUntilNext < 0 && scheduled.isActive && 'border-red-200 bg-red-50/30'
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              EMOJI_BOX_16,
              scheduled.type === 'income' ? 'bg-green-100' : 'bg-red-100'
            )}>
              {scheduled.type === 'income' ? '💰' : '💸'}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                {scheduled.title}
                {scheduled.isActive ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    Активна
                  </span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    Неактивна
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
                <span>{scheduled.account?.name || 'Счет удален'}</span>
                <span>•</span>
                <span>{scheduled.category?.name || 'Без категории'}</span>
                <span>•</span>
                <span>{frequencyLabel}</span>
                {scheduled.customDays && (
                  <span>(каждые {scheduled.customDays} дн.)</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {scheduled.isActive && (
              <>
                <button
                  type="button"
                  onClick={() => setShowExecuteModal(true)}
                  disabled={loading}
                  className="p-1.5 text-green-600 hover:text-green-700 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
                  title="Выполнить сейчас"
                >
                  <Play className={ICON_16} />
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={loading}
                  className="p-1.5 text-orange-600 hover:text-orange-700 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
                  title="Пропустить"
                >
                  <SkipForward className={ICON_16} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => onEdit(scheduled)}
              className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
              title="Редактировать"
            >
              <Edit2 className={ICON_16} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(scheduled.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              title="Удалить"
            >
              <Trash2 className={ICON_16} />
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <p className="text-sm text-gray-500">Сумма</p>
                <p className={cn(
                  'font-bold',
                  scheduled.type === 'income' ? 'text-green-600' : 'text-red-600'
                )}>
                  {scheduled.type === 'income' ? '+' : '-'}
                  {formatCurrency(Number(scheduled.amount), scheduled.account?.currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Следующее выполнение</p>
                <p className="font-medium text-gray-900 flex items-center gap-1 flex-wrap">
                  <Calendar className={cn(ICON_16, 'text-gray-400')} />
                  {format(new Date(scheduled.nextExecutionDate), 'dd MMM yyyy', { locale: ru })}
                  <span className={cn(
                    'text-xs',
                    daysUntilNext < 0 ? 'text-red-600' : 'text-gray-500'
                  )}>
                    ({daysText})
                  </span>
                </p>
              </div>
            </div>
            {scheduled.endDate && (
              <div>
                <p className="text-sm text-gray-500">Дата окончания</p>
                <p className="text-sm text-gray-700">
                  {format(new Date(scheduled.endDate), 'dd MMM yyyy', { locale: ru })}
                </p>
              </div>
            )}
            {scheduled.lastExecutedDate && (
              <div>
                <p className="text-sm text-gray-500">Последнее выполнение</p>
                <p className="text-sm text-gray-700">
                  {format(new Date(scheduled.lastExecutedDate), 'dd MMM yyyy', { locale: ru })}
                </p>
              </div>
            )}
          </div>
          {scheduled.note && (
            <p className="text-sm text-gray-500 mt-2">📝 {scheduled.note}</p>
          )}
        </div>
      </div>

      <ScheduledExecuteModal
        isOpen={showExecuteModal}
        onClose={() => setShowExecuteModal(false)}
        onSuccess={onSuccess}
        scheduled={scheduled}
      />
    </>
  )
}
