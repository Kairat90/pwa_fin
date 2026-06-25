import React from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { X } from 'lucide-react'
import { Debt } from '../../types'
import { formatCurrency } from '../../utils/currency'
import { cn } from '../../utils/cn'
import { EMOJI_BOX_16, ICON_16 } from '../../utils/iconSize'

interface DebtDetailModalProps {
  isOpen: boolean
  onClose: () => void
  debt: Debt | null
}

export const DebtDetailModal: React.FC<DebtDetailModalProps> = ({
  isOpen,
  onClose,
  debt
}) => {
  if (!isOpen || !debt) return null

  const remainingAmount = debt.remainingAmount ?? Number(debt.amount)
  const paidAmount = debt.paidAmount ?? (Number(debt.amount) - remainingAmount)
  const progress = Number(debt.amount) > 0 ? (paidAmount / Number(debt.amount)) * 100 : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={cn(EMOJI_BOX_16, 'rounded-full bg-gray-100')}>
              {debt.type === 'iOwe' ? '💳' : '💰'}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{debt.contact?.name}</h2>
              <p className="text-sm text-gray-500">
                {debt.type === 'iOwe' ? 'Я должен' : 'Мне должны'} • {debt.currency}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className={ICON_16} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500">Общая сумма</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(Number(debt.amount), debt.currency)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500">Погашено</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(paidAmount, debt.currency)}
              </p>
            </div>
            <div className={cn(
              'rounded-lg p-4 text-center',
              remainingAmount > 0 ? 'bg-red-50' : 'bg-green-50'
            )}>
              <p className="text-sm text-gray-500">Остаток</p>
              <p className={cn(
                'text-xl font-bold',
                remainingAmount > 0 ? 'text-red-600' : 'text-green-600'
              )}>
                {formatCurrency(remainingAmount, debt.currency)}
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Прогресс погашения</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div
                className={cn(
                  'h-2 rounded-full transition-all duration-500',
                  progress >= 100 ? 'bg-green-500' : 'bg-primary-500'
                )}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Статус</p>
              <p className="font-medium">
                {debt.status === 'active' ? '🟢 Активен'
                  : debt.status === 'overdue' ? '🔴 Просрочен'
                    : debt.status === 'settled' ? '✅ Погашен' : '⚪ Списан'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Дата взятия</p>
              <p className="font-medium">
                {format(new Date(debt.dateTaken), 'dd MMM yyyy', { locale: ru })}
              </p>
            </div>
            {debt.dueDate && (
              <div>
                <p className="text-gray-500">Дата возврата</p>
                <p className={cn('font-medium', debt.status === 'overdue' ? 'text-red-600' : '')}>
                  {format(new Date(debt.dueDate), 'dd MMM yyyy', { locale: ru })}
                  {debt.status === 'overdue' && ' ⚠️ Просрочен'}
                </p>
              </div>
            )}
            {debt.settledDate && (
              <div>
                <p className="text-gray-500">Дата погашения</p>
                <p className="font-medium text-green-600">
                  {format(new Date(debt.settledDate), 'dd MMM yyyy', { locale: ru })}
                </p>
              </div>
            )}
            {debt.interestRate != null && debt.interestRate > 0 && (
              <div>
                <p className="text-gray-500">Процентная ставка</p>
                <p className="font-medium">{debt.interestRate}% годовых</p>
              </div>
            )}
            <div>
              <p className="text-gray-500">В бюджете</p>
              <p className="font-medium">{debt.isInBudget ? '✅ Да' : '❌ Нет'}</p>
            </div>
          </div>

          {debt.purpose && (
            <div>
              <p className="text-sm text-gray-500">Цель</p>
              <p className="text-gray-700">{debt.purpose}</p>
            </div>
          )}

          {debt.payments && debt.payments.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">История платежей</h4>
              <div className="space-y-2">
                {debt.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(Number(payment.amount), debt.currency)}
                      </p>
                      {payment.note && (
                        <p className="text-sm text-gray-500">{payment.note}</p>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">
                      {format(new Date(payment.date), 'dd MMM yyyy, HH:mm', { locale: ru })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
