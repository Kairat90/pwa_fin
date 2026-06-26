import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Debt } from '../../types'
import { supabaseApi, getErrorMessage } from '../../api/supabase'
import { formatCurrency } from '../../utils/currency'
import { dateInputToIso, toDateInputValue } from '../../utils/dateInput'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Сумма должна быть больше 0'),
  date: z.string().min(1, 'Дата обязательна'),
  note: z.string().optional(),
  createTransaction: z.boolean().default(true)
})

type PaymentFormData = z.infer<typeof paymentSchema>

interface DebtPaymentFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  debt: Debt
}

export const DebtPaymentForm: React.FC<DebtPaymentFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  debt
}) => {
  const [loading, setLoading] = useState(false)
  const remainingAmount = debt.remainingAmount ?? Number(debt.amount)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      date: toDateInputValue(),
      createTransaction: true,
      amount: remainingAmount
    }
  })

  useEffect(() => {
    if (isOpen) {
      reset({
        date: toDateInputValue(),
        createTransaction: true,
        amount: remainingAmount,
        note: ''
      })
    }
  }, [isOpen, remainingAmount, reset])

  const onSubmit = async (data: PaymentFormData) => {
    try {
      setLoading(true)
      const result = await supabaseApi.debts.addPayment(debt.id, {
        amount: data.amount,
        date: dateInputToIso(data.date),
        note: data.note,
        createTransaction: data.createTransaction
      })

      if (result.isFullyPaid) {
        toast.success('Долг полностью погашен!')
      } else {
        toast.success(`Платеж добавлен. Остаток: ${formatCurrency(result.remainingAmount, debt.currency)}`)
      }
      onSuccess()
      onClose()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Ошибка добавления платежа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Добавить платеж" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Остаток долга</span>
            <span className="font-bold text-gray-900">
              {formatCurrency(remainingAmount, debt.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm text-gray-600">Контакт</span>
            <span className="text-gray-900">{debt.contact?.name}</span>
          </div>
        </div>

        <Input
          label="Сумма платежа *"
          type="number"
          step="0.01"
          placeholder={String(remainingAmount)}
          error={errors.amount?.message}
          {...register('amount')}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
          <input
            type="date"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
            {...register('date')}
          />
          {errors.date && (
            <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
          )}
        </div>

        <Input
          label="Примечание (опционально)"
          placeholder="Частичный возврат"
          error={errors.note?.message}
          {...register('note')}
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="createTransaction"
            className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
            {...register('createTransaction')}
          />
          <label htmlFor="createTransaction" className="text-sm text-gray-700">
            Создать транзакцию в бюджете
          </label>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Отмена
          </Button>
          <Button type="submit" loading={loading} className="flex-1 bg-green-600 hover:bg-green-700">
            Добавить платеж
          </Button>
        </div>
      </form>
    </Modal>
  )
}
