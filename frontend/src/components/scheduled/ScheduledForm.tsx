import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ScheduledTransaction, Account, Category } from '../../types'
import { supabaseApi, getErrorMessage, ScheduledCreateData } from '../../api/supabase'
import { cn } from '../../utils/cn'
import { buildCategoryTree, flattenCategoryTree, formatCategoryOptionLabel } from '../../utils/categoryTree'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

const scheduledSchema = z.object({
  accountId: z.string().min(1, 'Выберите счет'),
  categoryId: z.string().optional(),
  title: z.string().min(1, 'Название обязательно'),
  amount: z.coerce.number().min(0.01, 'Сумма должна быть больше 0'),
  type: z.enum(['income', 'expense']),
  startDate: z.string().min(1, 'Дата начала обязательна'),
  endDate: z.string().optional(),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'yearly', 'custom']),
  customDays: z.coerce.number().min(1, 'Укажите количество дней').optional(),
  note: z.string().optional(),
  isActive: z.boolean().default(true)
}).refine((data) => {
  if (data.frequency === 'custom' && !data.customDays) {
    return false
  }
  return true
}, {
  message: 'Для кастомной периодичности укажите количество дней',
  path: ['customDays']
})

type ScheduledFormData = z.infer<typeof scheduledSchema>

interface ScheduledFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  scheduled?: ScheduledTransaction
}

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Ежедневно' },
  { value: 'weekly', label: 'Еженедельно' },
  { value: 'biweekly', label: 'Раз в 2 недели' },
  { value: 'monthly', label: 'Ежемесячно' },
  { value: 'yearly', label: 'Ежегодно' },
  { value: 'custom', label: 'Своя периодичность' }
] as const

export const ScheduledForm: React.FC<ScheduledFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  scheduled
}) => {
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset
  } = useForm<ScheduledFormData>({
    resolver: zodResolver(scheduledSchema),
    defaultValues: {
      type: 'expense',
      frequency: 'monthly',
      startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      isActive: true
    }
  })

  const frequency = watch('frequency')
  const selectedType = watch('type')

  useEffect(() => {
    if (!isOpen) return

    if (scheduled) {
      reset({
        accountId: scheduled.accountId,
        categoryId: scheduled.categoryId || '',
        title: scheduled.title,
        amount: Number(scheduled.amount),
        type: scheduled.type,
        startDate: format(new Date(scheduled.startDate), "yyyy-MM-dd'T'HH:mm"),
        endDate: scheduled.endDate ? format(new Date(scheduled.endDate), "yyyy-MM-dd'T'HH:mm") : '',
        frequency: scheduled.frequency,
        customDays: scheduled.customDays || undefined,
        note: scheduled.note || '',
        isActive: scheduled.isActive
      })
    } else {
      reset({
        accountId: '',
        categoryId: '',
        title: '',
        amount: undefined,
        type: 'expense',
        startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        endDate: '',
        frequency: 'monthly',
        customDays: undefined,
        note: '',
        isActive: true
      })
    }
  }, [isOpen, scheduled, reset])

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true)
        const [accountsRes, categoriesRes] = await Promise.all([
          supabaseApi.accounts.getAll(),
          supabaseApi.categories.getAll(selectedType)
        ])
        setAccounts(accountsRes)
        setCategories(categoriesRes)
      } catch {
        toast.error('Ошибка загрузки данных')
      } finally {
        setLoadingData(false)
      }
    }

    if (isOpen) {
      loadData()
    }
  }, [isOpen, selectedType])

  const onSubmit = async (data: ScheduledFormData) => {
    try {
      setLoading(true)
      const payload: ScheduledCreateData = {
        accountId: data.accountId,
        categoryId: data.categoryId || undefined,
        title: data.title,
        amount: data.amount,
        type: data.type,
        startDate: new Date(data.startDate).toISOString(),
        endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
        frequency: data.frequency,
        customDays: data.frequency === 'custom' ? data.customDays : undefined,
        note: data.note,
        isActive: data.isActive
      }

      if (scheduled) {
        await supabaseApi.scheduled.update(scheduled.id, payload)
        toast.success('Операция обновлена')
      } else {
        await supabaseApi.scheduled.create(payload)
        toast.success('Операция создана')
      }
      onSuccess()
      onClose()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const categoryOptions = flattenCategoryTree(buildCategoryTree(categories))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={scheduled ? 'Редактировать операцию' : 'Новая запланированная операция'}
      size="lg"
    >
      {loadingData ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Название"
            placeholder="Например: Аренда квартиры"
            error={errors.title?.message}
            {...register('title')}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setValue('type', 'expense')}
                className={cn(
                  'p-3 rounded-lg border-2 transition-colors text-center',
                  selectedType === 'expense'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                💸 Расход
              </button>
              <button
                type="button"
                onClick={() => setValue('type', 'income')}
                className={cn(
                  'p-3 rounded-lg border-2 transition-colors text-center',
                  selectedType === 'income'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                💰 Доход
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Счет</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...register('accountId')}
              >
                <option value="">Выберите счет</option>
                {accounts.filter((a) => !a.isArchived).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.icon} {account.name}
                  </option>
                ))}
              </select>
              {errors.accountId && (
                <p className="mt-1 text-sm text-red-600">{errors.accountId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...register('categoryId')}
              >
                <option value="">Без категории</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {formatCategoryOptionLabel(category, category.depth)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Сумма"
              type="number"
              step="0.01"
              placeholder="0.00"
              error={errors.amount?.message}
              {...register('amount')}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Периодичность</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...register('frequency')}
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {frequency === 'custom' && (
            <Input
              label="Количество дней между выполнениями"
              type="number"
              placeholder="Например: 30"
              error={errors.customDays?.message}
              {...register('customDays')}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...register('startDate')}
              />
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата окончания (опционально)</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...register('endDate')}
              />
            </div>
          </div>

          <Input
            label="Примечание (опционально)"
            placeholder="Дополнительная информация"
            error={errors.note?.message}
            {...register('note')}
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
              {...register('isActive')}
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">
              Операция активна
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Отмена
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              {scheduled ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
