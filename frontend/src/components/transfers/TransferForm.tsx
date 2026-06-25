import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Account } from '../../types'
import { supabaseApi, getErrorMessage } from '../../api/supabase'
import { formatCurrency } from '../../utils/currency'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

const transferSchema = z.object({
  fromAccountId: z.string().min(1, 'Выберите счет-отправитель'),
  toAccountId: z.string().min(1, 'Выберите счет-получатель'),
  amount: z.coerce.number().min(0.01, 'Сумма должна быть больше 0'),
  fee: z.coerce.number().min(0, 'Комиссия не может быть отрицательной').optional(),
  date: z.string().min(1, 'Дата обязательна'),
  note: z.string().optional()
}).refine((data) => data.fromAccountId !== data.toAccountId, {
  message: 'Счета должны быть разными',
  path: ['toAccountId']
})

type TransferFormData = z.infer<typeof transferSchema>

interface TransferFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  defaultFromAccountId?: string
}

export const TransferForm: React.FC<TransferFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultFromAccountId
}) => {
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors }
  } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromAccountId: defaultFromAccountId || '',
      date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      fee: 0
    }
  })

  const fromAccountId = watch('fromAccountId')
  const amount = watch('amount') || 0
  const fee = watch('fee') || 0

  const fromAccount = accounts.find((a) => a.id === fromAccountId)
  const toAccountId = watch('toAccountId')
  const toAccount = accounts.find((a) => a.id === toAccountId)
  const totalWithFee = Number(amount) + Number(fee)

  useEffect(() => {
    if (!isOpen) return

    reset({
      fromAccountId: defaultFromAccountId || '',
      toAccountId: '',
      amount: undefined,
      fee: 0,
      date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      note: ''
    })
  }, [isOpen, defaultFromAccountId, reset])

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true)
        const accounts = await supabaseApi.accounts.getAll()
        setAccounts(accounts)
      } catch {
        toast.error('Ошибка загрузки счетов')
      } finally {
        setLoadingData(false)
      }
    }

    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const onSubmit = async (data: TransferFormData) => {
    try {
      setLoading(true)
      await supabaseApi.transfers.create({
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        amount: data.amount,
        fee: data.fee || 0,
        date: new Date(data.date).toISOString(),
        note: data.note
      })
      toast.success('Перевод выполнен')
      onSuccess()
      onClose()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Перевод между счетами" size="lg">
      {loadingData ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Со счета</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...register('fromAccountId')}
              >
                <option value="">Выберите счет</option>
                {accounts.filter((a) => !a.isArchived).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.icon} {account.name} ({formatCurrency(Number(account.balance ?? account.initialBalance), account.currency)})
                  </option>
                ))}
              </select>
              {errors.fromAccountId && (
                <p className="mt-1 text-sm text-red-600">{errors.fromAccountId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">На счет</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...register('toAccountId')}
              >
                <option value="">Выберите счет</option>
                {accounts
                  .filter((a) => !a.isArchived && a.id !== fromAccountId)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.icon} {account.name} ({formatCurrency(Number(account.balance ?? account.initialBalance), account.currency)})
                    </option>
                  ))}
              </select>
              {errors.toAccountId && (
                <p className="mt-1 text-sm text-red-600">{errors.toAccountId.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Сумма перевода"
              type="number"
              step="0.01"
              placeholder="0.00"
              error={errors.amount?.message}
              {...register('amount')}
            />
            <Input
              label="Комиссия"
              type="number"
              step="0.01"
              placeholder="0.00"
              error={errors.fee?.message}
              {...register('fee')}
            />
          </div>

          {fromAccount && toAccount && amount > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="text-gray-600">
                Итого списание: <span className="font-medium text-gray-900">{formatCurrency(totalWithFee, fromAccount.currency)}</span>
              </p>
              <p className="text-gray-600">
                Зачисление: <span className="font-medium text-gray-900">{formatCurrency(Number(amount), toAccount.currency)}</span>
              </p>
              {fromAccount.currency !== toAccount.currency && (
                <p className="text-yellow-600 text-xs mt-1">
                  ⚠️ Внимание: валюты разные. Будет использован курс по умолчанию.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
            <input
              type="datetime-local"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              {...register('date')}
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
            )}
          </div>

          <Input
            label="Примечание (опционально)"
            placeholder="Например: Пополнение карты"
            error={errors.note?.message}
            {...register('note')}
          />

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Отмена
            </Button>
            <Button type="submit" loading={loading} className="flex-1 bg-blue-600 hover:bg-blue-700">
              Выполнить перевод
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
