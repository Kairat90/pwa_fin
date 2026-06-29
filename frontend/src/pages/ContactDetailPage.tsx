import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Phone,
  Mail,
  User,
  HandCoins,
  Receipt,
  Plus,
  Star
} from 'lucide-react'
import { supabaseApi, getErrorMessage } from '../api/supabase'
import { Debt, DebtEntryMode, DebtPayment } from '../types'
import { formatCurrency } from '../utils/currency'
import { cn } from '../utils/cn'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { DebtDetailModal } from '../components/debts/DebtDetailModal'
import { DebtPaymentForm } from '../components/debts/DebtPaymentForm'
import { EMOJI_BOX_16, ICON_16 } from '../utils/iconSize'

const DEBT_STATUS: Record<string, string> = {
  active: 'Активен',
  overdue: 'Просрочен',
  settled: 'Погашен',
  writtenOff: 'Списан'
}

function debtRemaining(debt: Debt): number {
  return Math.max(0, debt.remainingAmount ?? Number(debt.amount))
}

function paymentEntryLabel(payment: DebtPayment, debtType: Debt['type']): string {
  if (payment.entryType === 'initial') {
    return debtType === 'iOwe' ? 'Первоначальный займ' : 'Первоначальная выдача'
  }

  if (payment.entryType === 'increase') {
    return debtType === 'iOwe' ? 'Увеличение долга' : 'Доп. выдача'
  }

  return debtType === 'iOwe' ? 'Погашение долга' : 'Возврат долга'
}

/** Страница истории контакта: долги, платежи, итоги */
const ContactDetailPage: React.FC = () => {
  const { contactId } = useParams<{ contactId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [entryMode, setEntryMode] = useState<DebtEntryMode>('repayment')
  const [editingPayment, setEditingPayment] = useState<DebtPayment | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['contactHistory', contactId],
    queryFn: () => supabaseApi.contacts.getHistory(contactId!),
    enabled: Boolean(contactId)
  })

  const refreshDebtData = async (debtId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['contactHistory', contactId] })
    queryClient.invalidateQueries({ queryKey: ['debts'] })
    queryClient.invalidateQueries({ queryKey: ['debtStats'] })
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    queryClient.invalidateQueries({ queryKey: ['transactions'] })

    if (debtId) {
      try {
        const updated = await supabaseApi.debts.getOne(debtId)
        setSelectedDebt(updated)
      } catch {
        // история обновится через invalidate
      }
    }

    await refetch()
  }

  const handleViewDebt = async (debt: Debt) => {
    try {
      const full = await supabaseApi.debts.getOne(debt.id)
      setSelectedDebt(full)
      setShowDetailModal(true)
    } catch {
      toast.error('Не удалось загрузить детали долга')
    }
  }

  const openEntryForm = (mode: DebtEntryMode, payment: DebtPayment | null = null) => {
    setEntryMode(mode)
    setEditingPayment(payment)
    setShowEntryForm(true)
  }

  const handleEditPayment = (payment: DebtPayment) => {
    if (payment.id.startsWith('virtual-')) {
      toast.error('Примените SQL-миграцию 20250115 для редактирования первоначального займа')
      return
    }

    const mode: DebtEntryMode =
      payment.entryType === 'increase'
        ? 'increase'
        : payment.entryType === 'initial'
          ? 'initial'
          : 'repayment'

    openEntryForm(mode, payment)
  }

  const handleDeletePayment = async (payment: DebtPayment) => {
    if (!selectedDebt) return

    if (!window.confirm('Удалить эту операцию? Связанная транзакция в бюджете тоже будет удалена.')) {
      return
    }

    try {
      await supabaseApi.debts.deletePayment(payment.id)
      toast.success('Операция удалена')
      await refreshDebtData(selectedDebt.id)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Не удалось удалить операцию')
    }
  }

  const handleEntrySuccess = async () => {
    await refreshDebtData(selectedDebt?.id)
    setEditingPayment(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-gray-500">Контакт не найден</p>
        <Button variant="outline" onClick={() => navigate('/contacts')}>
          К списку контактов
        </Button>
      </div>
    )
  }

  const { contact, debts, summaries, payments } = data
  const hasOpenDebts = summaries.length > 0

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/contacts')}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Назад"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
            {contact.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">История по контакту</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate('/debts')}
          className="shrink-0"
        >
          <Plus className="w-4 h-4 mr-1" />
          Долг
        </Button>
      </div>

      <Card>
        <div className="flex items-start gap-4">
          <div className={cn(EMOJI_BOX_16, 'w-12 h-12 rounded-full bg-primary-100 text-primary-600 overflow-hidden shrink-0')}>
            {contact.avatarData ? (
              <img src={contact.avatarData} alt={contact.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 m-auto" />
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-gray-100">{contact.name}</span>
              {contact.isFavorite && (
                <Star className={cn(ICON_16, 'text-yellow-400 fill-yellow-400')} />
              )}
            </div>
            {contact.phone && (
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Phone className={ICON_16} />
                {contact.phone}
              </p>
            )}
            {contact.email && (
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Mail className={ICON_16} />
                {contact.email}
              </p>
            )}
            {contact.note && (
              <p className="text-sm text-gray-400 mt-2">{contact.note}</p>
            )}
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <HandCoins className={ICON_16} />
          Итог по открытым долгам
        </h2>

        {!hasOpenDebts && (
          <Card className="text-center py-6 text-gray-500 dark:text-gray-400">
            Нет активных долгов с этим контактом
          </Card>
        )}

        {summaries.map((row) => (
          <div key={row.currency} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 last:mb-0">
            <Card className="text-center py-4 bg-green-50/50 dark:bg-green-950/20 border-green-100 dark:border-green-900/40">
              <p className="text-sm text-gray-500 dark:text-gray-400">Мне должны</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">
                {formatCurrency(row.totalOwedToMe, row.currency)}
              </p>
            </Card>
            <Card className="text-center py-4 bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900/40">
              <p className="text-sm text-gray-500 dark:text-gray-400">Я должен</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
                {formatCurrency(row.totalIOwe, row.currency)}
              </p>
            </Card>
            <Card className="text-center py-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Чистая позиция</p>
              <p
                className={cn(
                  'text-xl font-bold mt-1',
                  row.netPosition >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )}
              >
                {row.netPosition >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(row.netPosition), row.currency)}
              </p>
            </Card>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Все долги ({debts.length})
        </h2>

        {debts.length === 0 ? (
          <Card className="text-center py-8 text-gray-500">
            Долгов с этим контактом пока нет
          </Card>
        ) : (
          <div className="space-y-3">
            {debts.map((debt) => {
              const remaining = debtRemaining(debt)
              const paid = debt.paidAmount ?? Number(debt.amount) - remaining

              return (
                <button
                  key={debt.id}
                  type="button"
                  onClick={() => void handleViewDebt(debt)}
                  className={cn(
                    'w-full text-left rounded-xl border p-4 transition-shadow hover:shadow-md',
                    'bg-white dark:bg-gray-900',
                    debt.status === 'overdue'
                      ? 'border-red-200 dark:border-red-900/50'
                      : 'border-gray-200 dark:border-gray-800'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg" aria-hidden>
                          {debt.type === 'iOwe' ? '💳' : '💰'}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {debt.type === 'iOwe' ? 'Я должен' : 'Мне должны'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          {DEBT_STATUS[debt.status] ?? debt.status}
                        </span>
                      </div>
                      {debt.purpose && (
                        <p className="text-sm text-gray-500 mt-1 truncate">{debt.purpose}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {format(new Date(debt.dateTaken), 'dd MMM yyyy', { locale: ru })}
                        {debt.dueDate && (
                          <> · возврат {format(new Date(debt.dueDate), 'dd MMM yyyy', { locale: ru })}</>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency(Number(debt.amount), debt.currency)}
                      </p>
                      {remaining > 0 && remaining < Number(debt.amount) && (
                        <p className="text-sm text-red-600">
                          остаток {formatCurrency(remaining, debt.currency)}
                        </p>
                      )}
                      {remaining === 0 && debt.status === 'settled' && (
                        <p className="text-sm text-green-600">
                          погашено {formatCurrency(paid, debt.currency)}
                        </p>
                      )}
                    </div>
                  </div>
                  {(debt.payments?.length ?? 0) > 0 && (
                    <p className="text-xs text-gray-400 mt-2">
                      Операций: {debt.payments!.length}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Receipt className={ICON_16} />
          Все операции ({payments.length})
        </h2>

        {payments.length === 0 ? (
          <Card className="text-center py-8 text-gray-500">
            Операций пока нет
          </Card>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => {
              const isIncrease = payment.entryType === 'increase'
              const isInitial = payment.entryType === 'initial'
              const isRepayment = !isIncrease && !isInitial

              return (
                <div
                  key={payment.id}
                  className={cn(
                    'flex items-center justify-between gap-3 p-4 rounded-xl border',
                    isInitial
                      ? 'border-blue-100 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20'
                      : isIncrease
                        ? 'border-amber-100 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20'
                        : 'border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/30'
                  )}
                >
                  <div className="min-w-0">
                    <p className={cn(
                      'font-medium',
                      isInitial
                        ? 'text-blue-800 dark:text-blue-300'
                        : isIncrease
                          ? 'text-amber-800 dark:text-amber-300'
                          : 'text-gray-900 dark:text-gray-100'
                    )}>
                      {isRepayment ? '−' : '+'}
                      {formatCurrency(Number(payment.amount), payment.currency)}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {paymentEntryLabel(payment, payment.debtType)}
                      {payment.debtPurpose ? ` · ${payment.debtPurpose}` : ''}
                    </p>
                    {payment.note && (
                      <p className="text-sm text-gray-400 mt-0.5">{payment.note}</p>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 shrink-0">
                    {format(new Date(payment.date), 'dd MMM yyyy', { locale: ru })}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedDebt && (
        <>
          <DebtDetailModal
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false)
              setSelectedDebt(null)
            }}
            debt={selectedDebt}
            onRepay={() => openEntryForm('repayment')}
            onIncrease={() => openEntryForm('increase')}
            onEditPayment={handleEditPayment}
            onDeletePayment={(payment) => void handleDeletePayment(payment)}
          />

          <DebtPaymentForm
            isOpen={showEntryForm}
            onClose={() => {
              setShowEntryForm(false)
              setEditingPayment(null)
            }}
            onSuccess={() => void handleEntrySuccess()}
            debt={selectedDebt}
            mode={entryMode}
            payment={editingPayment}
          />
        </>
      )}
    </div>
  )
}

export default ContactDetailPage
