import React from 'react'
import { format, differenceInDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Edit2, Trash2, Plus, Calendar, AlertCircle, CheckCircle } from 'lucide-react'
import { Debt } from '../../types'
import { formatCurrency } from '../../utils/currency'
import { cn } from '../../utils/cn'

interface DebtCardProps {
  debt: Debt
  onEdit: (debt: Debt) => void
  onDelete: (id: string) => void
  onAddPayment: (debt: Debt) => void
  onViewDetails: (debt: Debt) => void
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: 'Активен', color: 'bg-blue-100 text-blue-700', icon: <Calendar className="w-3 h-3" /> },
  overdue: { label: 'Просрочен', color: 'bg-red-100 text-red-700', icon: <AlertCircle className="w-3 h-3" /> },
  settled: { label: 'Погашен', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
  writtenOff: { label: 'Списан', color: 'bg-gray-100 text-gray-600', icon: <AlertCircle className="w-3 h-3" /> }
}

export const DebtCard: React.FC<DebtCardProps> = ({
  debt,
  onEdit,
  onDelete,
  onAddPayment,
  onViewDetails
}) => {
  const status = STATUS_LABELS[debt.status] || STATUS_LABELS.active
  const remainingAmount = debt.remainingAmount ?? Number(debt.amount)
  const paidAmount = Number(debt.amount) - remainingAmount
  const progress = Number(debt.amount) > 0 ? (paidAmount / Number(debt.amount)) * 100 : 0
  const isOverdue = debt.status === 'overdue'

  return (
    <div
      className={cn(
        'bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-all cursor-pointer',
        isOverdue && 'border-red-200 bg-red-50/30'
      )}
      onClick={() => onViewDetails(debt)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onViewDetails(debt)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">
              {debt.type === 'iOwe' ? '💳' : '💰'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900">
                  {debt.contact?.name || 'Контакт удален'}
                </h3>
                <span className={cn('text-xs px-2 py-0.5 rounded-full flex items-center gap-1', status.color)}>
                  {status.icon}
                  {status.label}
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {debt.type === 'iOwe' ? 'Я должен' : 'Мне должны'}
                </span>
              </div>
              {debt.purpose && (
                <p className="text-sm text-gray-500 truncate">{debt.purpose}</p>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Сумма</p>
              <p className="font-bold text-gray-900">
                {formatCurrency(Number(debt.amount), debt.currency)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Остаток</p>
              <p className={cn(
                'font-bold',
                remainingAmount > 0 ? 'text-red-600' : 'text-green-600'
              )}>
                {formatCurrency(remainingAmount, debt.currency)}
              </p>
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Погашено</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className={cn(
                  'h-1.5 rounded-full transition-all duration-500',
                  progress >= 100 ? 'bg-green-500' : 'bg-primary-500'
                )}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {debt.dueDate && (
            <div className="mt-2 flex items-center gap-1 text-sm">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className={cn(
                isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'
              )}>
                {isOverdue ? 'Просрочен' : 'Срок возврата'}: {format(new Date(debt.dueDate), 'dd MMM yyyy', { locale: ru })}
                {isOverdue && ` (${differenceInDays(new Date(), new Date(debt.dueDate))} дн. назад)`}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 ml-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {debt.status !== 'settled' && debt.status !== 'writtenOff' && (
            <button
              type="button"
              onClick={() => onAddPayment(debt)}
              className="p-1.5 text-green-600 hover:text-green-700 rounded-lg hover:bg-green-50 transition-colors"
              title="Добавить платеж"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(debt)}
            className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(debt.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            title="Списать долг"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
