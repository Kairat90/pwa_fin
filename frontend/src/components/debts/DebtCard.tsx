import React from 'react'
import { Edit2, Trash2, Calendar, AlertCircle, CheckCircle } from 'lucide-react'
import { Debt } from '../../types'
import { formatCurrency } from '../../utils/currency'
import { cn } from '../../utils/cn'
import { EMOJI_BOX_16, ICON_16 } from '../../utils/iconSize'

interface DebtCardProps {
  debt: Debt
  onEdit: (debt: Debt) => void
  onDelete: (id: string) => void
  onViewDetails: (debt: Debt) => void
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: 'Активен', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', icon: <Calendar className={ICON_16} /> },
  overdue: { label: 'Просрочен', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', icon: <AlertCircle className={ICON_16} /> },
  settled: { label: 'Погашен', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', icon: <CheckCircle className={ICON_16} /> },
  writtenOff: { label: 'Списан', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: <AlertCircle className={ICON_16} /> }
}

/** Компактная карточка долга в общем списке */
export const DebtCard: React.FC<DebtCardProps> = ({
  debt,
  onEdit,
  onDelete,
  onViewDetails
}) => {
  const status = STATUS_LABELS[debt.status] || STATUS_LABELS.active
  const remainingAmount = debt.remainingAmount ?? Number(debt.amount)
  const isOverdue = debt.status === 'overdue'
  const isSettled = remainingAmount <= 0 || debt.status === 'settled'
  const isOwedToMe = debt.type === 'owedToMe'

  const amountColor = isSettled
    ? 'text-green-600 dark:text-green-400'
    : isOwedToMe
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400'

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 px-3 py-2.5 shadow-sm hover:shadow-md transition-all cursor-pointer',
        isOverdue && 'border-red-200 bg-red-50/30 dark:border-red-900/40'
      )}
      onClick={() => onViewDetails(debt)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onViewDetails(debt)}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div className={cn(EMOJI_BOX_16, 'rounded-full bg-gray-100 dark:bg-gray-800 shrink-0')}>
          {debt.type === 'iOwe' ? '💳' : '💰'}
        </div>

        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate shrink-0 max-w-[40%] sm:max-w-none">
            {debt.contact?.name || 'Контакт удалён'}
          </h3>

          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full whitespace-nowrap">
              {debt.type === 'iOwe' ? 'Я должен' : 'Мне должны'}
            </span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap', status.color)}>
              {status.icon}
              {status.label}
            </span>
          </div>
        </div>

        <p className={cn('font-semibold text-sm sm:text-base shrink-0 tabular-nums', amountColor)}>
          {formatCurrency(remainingAmount, debt.currency)}
        </p>

        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onEdit(debt)}
            className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
            title="Редактировать"
          >
            <Edit2 className={ICON_16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(debt.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            title="Списать долг"
          >
            <Trash2 className={ICON_16} />
          </button>
        </div>
      </div>
    </div>
  )
}
