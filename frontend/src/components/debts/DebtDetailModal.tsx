import React from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { X, MinusCircle, PlusCircle, Pencil, Trash2 } from 'lucide-react'
import { Debt, DebtPayment } from '../../types'
import { formatCurrency } from '../../utils/currency'
import { cn } from '../../utils/cn'
import {
  canDeleteDebtPayment,
  canEditDebtPayment,
  debtEntryTypeLabel,
  getDebtHistoryPayments
} from '../../utils/debtHistory'
import { Button } from '../ui/Button'
import { EMOJI_BOX_16, ICON_16 } from '../../utils/iconSize'

interface DebtDetailModalProps {
  isOpen: boolean
  onClose: () => void
  debt: Debt | null
  onRepay?: () => void
  onIncrease?: () => void
  onEditPayment?: (payment: DebtPayment) => void
  onDeletePayment?: (payment: DebtPayment) => void
}

/** Модальное окно деталей долга с историей операций */
export const DebtDetailModal: React.FC<DebtDetailModalProps> = ({
  isOpen,
  onClose,
  debt,
  onRepay,
  onIncrease,
  onEditPayment,
  onDeletePayment
}) => {
  if (!isOpen || !debt) return null

  const remainingAmount = debt.remainingAmount ?? Number(debt.amount)
  const paidAmount = debt.paidAmount ?? (Number(debt.amount) - remainingAmount)
  const progress = Number(debt.amount) > 0 ? (paidAmount / Number(debt.amount)) * 100 : 0
  const canOperate = debt.status !== 'writtenOff'
  const historyPayments = getDebtHistoryPayments(debt)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(EMOJI_BOX_16, 'rounded-full bg-gray-100 dark:bg-gray-800')}>
              {debt.type === 'iOwe' ? '💳' : '💰'}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">
                {debt.contact?.name}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {debt.type === 'iOwe' ? 'Я должен' : 'Мне должны'} • {debt.currency}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className={ICON_16} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {canOperate && (onRepay || onIncrease) && (
            <div className="flex flex-col sm:flex-row gap-2">
              {onRepay && (
                <Button
                  type="button"
                  onClick={onRepay}
                  className="flex-1 bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <MinusCircle className={ICON_16} />
                  Погасить
                </Button>
              )}
              {onIncrease && (
                <Button
                  type="button"
                  onClick={onIncrease}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 flex items-center justify-center gap-2"
                >
                  <PlusCircle className={ICON_16} />
                  Увеличить долг
                </Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500">Общая сумма</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(Number(debt.amount), debt.currency)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500">Погашено</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(paidAmount, debt.currency)}
              </p>
            </div>
            <div className={cn(
              'rounded-lg p-4 text-center',
              remainingAmount > 0 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-green-50 dark:bg-green-950/20'
            )}>
              <p className="text-sm text-gray-500">Остаток</p>
              <p className={cn('text-xl font-bold', remainingAmount > 0 ? 'text-red-600' : 'text-green-600')}>
                {formatCurrency(remainingAmount, debt.currency)}
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Прогресс погашения</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
              <div
                className={cn(
                  'h-2 rounded-full transition-all duration-500',
                  progress >= 100 ? 'bg-green-500' : 'bg-primary-500'
                )}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {debt.purpose && (
            <div>
              <p className="text-sm text-gray-500">Цель</p>
              <p className="text-gray-700 dark:text-gray-300">{debt.purpose}</p>
            </div>
          )}

          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
              История операций ({historyPayments.length})
            </h4>

            {historyPayments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">Операций пока нет</p>
            ) : (
              <div className="space-y-2">
                {historyPayments.map((payment) => {
                  const isIncrease = payment.entryType === 'increase'
                  const isInitial = payment.entryType === 'initial'
                  const isRepayment = !isIncrease && !isInitial
                  const editable = canEditDebtPayment(payment)
                  const deletable = canDeleteDebtPayment(payment)

                  return (
                    <div
                      key={payment.id}
                      className={cn(
                        'flex items-center justify-between gap-3 p-3 rounded-lg border',
                        isInitial
                          ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20'
                          : isIncrease
                            ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20'
                            : 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={cn(
                            'font-medium',
                            isInitial
                              ? 'text-blue-800 dark:text-blue-300'
                              : isIncrease
                                ? 'text-amber-800 dark:text-amber-300'
                                : 'text-gray-900 dark:text-gray-100'
                          )}>
                            {isRepayment ? '−' : '+'}
                            {formatCurrency(Number(payment.amount), debt.currency)}
                          </p>
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            isInitial
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                              : isIncrease
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                          )}>
                            {debtEntryTypeLabel(payment.entryType)}
                          </span>
                        </div>
                        {payment.note && (
                          <p className="text-sm text-gray-500 mt-0.5">{payment.note}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {format(new Date(payment.date), 'dd MMM yyyy, HH:mm', { locale: ru })}
                        </p>
                      </div>

                      {(onEditPayment || onDeletePayment) && (editable || deletable) && (
                        <div className="flex items-center gap-1 shrink-0">
                          {onEditPayment && editable && (
                            <button
                              type="button"
                              onClick={() => onEditPayment(payment)}
                              className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30"
                              title="Редактировать"
                            >
                              <Pencil className={ICON_16} />
                            </button>
                          )}
                          {onDeletePayment && deletable && (
                            <button
                              type="button"
                              onClick={() => onDeletePayment(payment)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30"
                              title="Удалить"
                            >
                              <Trash2 className={ICON_16} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
