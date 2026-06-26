import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
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
import { supabaseApi } from '../api/supabase'
import { Debt } from '../types'
import { formatCurrency } from '../utils/currency'
import { cn } from '../utils/cn'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { DebtDetailModal } from '../components/debts/DebtDetailModal'
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

/** Страница истории контакта: долги, платежи, итоги */
const ContactDetailPage: React.FC = () => {
  const { contactId } = useParams<{ contactId: string }>()
  const navigate = useNavigate()
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['contactHistory', contactId],
    queryFn: () => supabaseApi.contacts.getHistory(contactId!),
    enabled: Boolean(contactId)
  })

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
                  onClick={() => setSelectedDebt(debt)}
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
                      Платежей: {debt.payments!.length}
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
          Все платежи ({payments.length})
        </h2>

        {payments.length === 0 ? (
          <Card className="text-center py-8 text-gray-500">
            Платежей пока нет
          </Card>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between gap-3 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(Number(payment.amount), payment.currency)}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {payment.debtType === 'iOwe' ? 'Погашение долга' : 'Возврат долга'}
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
            ))}
          </div>
        )}
      </div>

      <DebtDetailModal
        isOpen={Boolean(selectedDebt)}
        onClose={() => setSelectedDebt(null)}
        debt={selectedDebt}
      />
    </div>
  )
}

export default ContactDetailPage
