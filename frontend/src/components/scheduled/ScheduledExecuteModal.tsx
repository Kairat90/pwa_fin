import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { ScheduledTransaction } from '../../types'
import { supabaseApi, getErrorMessage } from '../../api/supabase'
import { formatCurrency } from '../../utils/currency'
import { dateInputToIso, toDateInputValue } from '../../utils/dateInput'
import { cn } from '../../utils/cn'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

const executeSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Сумма должна быть больше 0'),
  date: z.string().min(1, 'Дата обязательна'),
  note: z.string().optional()
})

type ExecuteFormData = z.infer<typeof executeSchema>

interface ScheduledExecuteModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  scheduled: ScheduledTransaction | null
}

/** Подтверждение выполнения запланированной операции с правкой суммы и даты */
export const ScheduledExecuteModal: React.FC<ScheduledExecuteModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  scheduled
}) => {
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ExecuteFormData>({
    resolver: zodResolver(executeSchema),
    defaultValues: {
      date: toDateInputValue(),
      amount: 0,
      note: ''
    }
  })

  useEffect(() => {
    if (!isOpen || !scheduled) {
      return
    }

    reset({
      amount: Number(scheduled.amount),
      date: toDateInputValue(),
      note: scheduled.note || ''
    })
  }, [isOpen, scheduled, reset])

  const onSubmit = async (data: ExecuteFormData) => {
    if (!scheduled) {
      return
    }

    try {
      setLoading(true)
      await supabaseApi.scheduled.execute(scheduled.id, {
        amount: data.amount,
        date: dateInputToIso(data.date),
        note: data.note?.trim() || undefined
      })
      toast.success('Операция выполнена')
      onSuccess()
      onClose()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Не удалось выполнить операцию')
    } finally {
      setLoading(false)
    }
  }

  if (!scheduled) {
    return null
  }

  const currency = scheduled.account?.currency

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Выполнить операцию"
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2">
          <p className="font-medium text-gray-900 dark:text-gray-100">{scheduled.title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {scheduled.type === 'income' ? 'Доход' : 'Расход'}
            {' · '}
            {scheduled.account?.name || 'Счёт'}
            {scheduled.category?.name ? ` · ${scheduled.category.name}` : ''}
          </p>
          <p className="text-sm text-gray-500">
            По шаблону:{' '}
            <span className={cn(
              'font-medium',
              scheduled.type === 'income' ? 'text-green-600' : 'text-red-600'
            )}>
              {scheduled.type === 'income' ? '+' : '−'}
              {formatCurrency(Number(scheduled.amount), currency)}
            </span>
          </p>
        </div>

        <Input
          label="Сумма фактического платежа *"
          type="number"
          step="0.01"
          error={errors.amount?.message}
          {...register('amount')}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Дата операции *
          </label>
          <input
            type="date"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-900 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
            {...register('date')}
          />
          {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>}
        </div>

        <Input
          label="Примечание"
          placeholder="Комментарий к транзакции"
          error={errors.note?.message}
          {...register('note')}
        />

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Шаблон планировщика не изменится — в бюджет попадёт указанная сумма. Следующая дата выполнения сдвинется по расписанию.
        </p>

        <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Отмена
          </Button>
          <Button type="submit" loading={loading} className="flex-1 bg-green-600 hover:bg-green-700">
            Выполнить
          </Button>
        </div>
      </form>
    </Modal>
  )
}
