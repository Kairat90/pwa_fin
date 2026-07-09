import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Account, Debt, DebtEntryMode, DebtPayment } from '../../types'
import { supabaseApi, getErrorMessage } from '../../api/supabase'
import { getAccountDisplayIcon } from '../../utils/accountIcons'
import { formatCurrency, normalizeCurrency } from '../../utils/currency'
import { dateInputToIso, toDateInputValue } from '../../utils/dateInput'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

const entrySchema = z.object({
  amount: z.coerce.number().min(0.01, 'Сумма должна быть больше 0'),
  date: z.string().min(1, 'Дата обязательна'),
  note: z.string().optional(),
  accountId: z.string().optional(),
  createTransaction: z.boolean().default(true)
}).refine(
  (data) => !data.createTransaction || Boolean(data.accountId),
  { message: 'Выберите счёт для транзакции', path: ['accountId'] }
)

type EntryFormData = z.infer<typeof entrySchema>

interface DebtPaymentFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  debt: Debt
  mode: DebtEntryMode
  payment?: DebtPayment | null
}

const MODE_LABELS: Record<DebtEntryMode, { title: string; submit: string; amount: string; note: string }> = {
  repayment: {
    title: 'Погашение долга',
    submit: 'Добавить погашение',
    amount: 'Сумма погашения *',
    note: 'Частичный возврат'
  },
  increase: {
    title: 'Увеличение долга',
    submit: 'Увеличить долг',
    amount: 'Сумма увеличения *',
    note: 'Дополнительная сумма'
  },
  initial: {
    title: 'Первоначальный займ',
    submit: 'Сохранить',
    amount: 'Сумма займа *',
    note: 'Цель / примечание'
  }
}

/** Форма погашения / увеличения долга (создание и редактирование) */
export const DebtPaymentForm: React.FC<DebtPaymentFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  debt,
  mode,
  payment = null
}) => {
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const isEdit = Boolean(payment)
  const isInitialMode = mode === 'initial'
  const hasLinkedTransaction = Boolean(payment?.transactionId)
  const labels = MODE_LABELS[mode]
  const remainingAmount = debt.remainingAmount ?? Number(debt.amount)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm<EntryFormData>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      date: toDateInputValue(),
      createTransaction: true,
      amount: remainingAmount,
      accountId: debt.accountId || ''
    }
  })

  const createTransaction = watch('createTransaction')
  const showAccountField = hasLinkedTransaction || isInitialMode || (!isEdit && createTransaction)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const loadAccounts = async () => {
      try {
        setLoadingAccounts(true)
        const list = await supabaseApi.accounts.getAll()
        const active = list.filter((a) => !a.isArchived)
        setAccounts(active)

        const defaultAccount =
          active.find((a) => a.id === debt.accountId)?.id ||
          active.find((a) => normalizeCurrency(a.currency) === normalizeCurrency(debt.currency))?.id ||
          active[0]?.id ||
          ''

        let accountId = defaultAccount

        if (payment?.transactionId) {
          try {
            const tx = await supabaseApi.transactions.getOne(payment.transactionId)
            accountId = tx.accountId || defaultAccount
          } catch {
            // оставляем счёт по умолчанию
          }
        }

        reset({
          date: payment ? toDateInputValue(payment.date) : toDateInputValue(),
          createTransaction: !isEdit,
          amount: payment ? Number(payment.amount) : (mode === 'repayment' ? remainingAmount : undefined),
          note: payment?.note || '',
          accountId
        })
      } catch {
        toast.error('Не удалось загрузить счета')
      } finally {
        setLoadingAccounts(false)
      }
    }

    void loadAccounts()
  }, [isOpen, debt.accountId, debt.currency, isEdit, mode, payment, remainingAmount, reset])

  const onSubmit = async (data: EntryFormData) => {
    try {
      setLoading(true)

      if (isEdit && payment) {
        if (showAccountField && !data.accountId) {
          toast.error('Выберите счёт для транзакции')
          return
        }

        await supabaseApi.debts.updatePayment(payment.id, {
          amount: data.amount,
          date: dateInputToIso(data.date),
          note: data.note,
          accountId: showAccountField ? data.accountId : undefined
        })
        toast.success('Операция обновлена')
      } else {
        const result = await supabaseApi.debts.addPayment(debt.id, {
          amount: data.amount,
          date: dateInputToIso(data.date),
          note: data.note,
          createTransaction: data.createTransaction,
          accountId: data.createTransaction ? data.accountId : undefined,
          entryType: mode
        })

        if (mode === 'repayment' && result.isFullyPaid) {
          toast.success('Долг полностью погашен!')
        } else {
          toast.success(mode === 'repayment' ? 'Погашение добавлено' : 'Долг увеличен')
        }
      }

      onSuccess()
      onClose()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Ошибка сохранения')
    } finally {
      setLoading(false)
    }
  }

  const accountHint = isInitialMode
    ? debt.type === 'iOwe'
      ? 'Счёт, с которого получены средства'
      : 'Счёт, с которого выдан займ'
    : mode === 'repayment'
      ? debt.type === 'iOwe'
        ? 'С какого счёта списать возврат долга'
        : 'На какой счёт зачислить возврат'
      : debt.type === 'iOwe'
        ? 'На какой счёт поступили дополнительные средства'
        : 'С какого счёта выдана дополнительная сумма'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Редактировать операцию' : labels.title}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Остаток</span>
            <span className="font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(remainingAmount, debt.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Сумма долга</span>
            <span className="text-gray-900 dark:text-gray-100">
              {formatCurrency(Number(debt.amount), debt.currency)}
            </span>
          </div>
        </div>

        <Input
          label={labels.amount}
          type="number"
          step="0.01"
          error={errors.amount?.message}
          {...register('amount')}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Дата</label>
          <input
            type="date"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-900 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
            {...register('date')}
          />
          {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>}
        </div>

        <Input
          label="Примечание (опционально)"
          placeholder={labels.note}
          error={errors.note?.message}
          {...register('note')}
        />

        {!isEdit && !isInitialMode && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="createTransaction"
              className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
              {...register('createTransaction')}
            />
            <label htmlFor="createTransaction" className="text-sm text-gray-700 dark:text-gray-300">
              Создать транзакцию в бюджете
            </label>
          </div>
        )}

        {showAccountField && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Счёт для транзакции *
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-900 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={loadingAccounts}
              {...register('accountId')}
            >
              <option value="">Выберите счёт</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {getAccountDisplayIcon(account)} {account.name} ({account.currency})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{accountHint}</p>
            {errors.accountId && (
              <p className="mt-1 text-sm text-red-600">{errors.accountId.message}</p>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Отмена
          </Button>
          <Button
            type="submit"
            loading={loading}
            className={`flex-1 ${
              mode === 'repayment'
                ? 'bg-green-600 hover:bg-green-700'
                : mode === 'initial'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {isEdit ? 'Сохранить' : labels.submit}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
