import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Debt, Account, Contact } from '../../types'
import { supabaseApi, getErrorMessage } from '../../api/supabase'
import { DEFAULT_CURRENCY } from '../../utils/currency'
import { cn } from '../../utils/cn'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

const debtSchema = z.object({
  contactId: z.string().min(1, 'Выберите контакт'),
  accountId: z.string().optional(),
  amount: z.coerce.number().min(0.01, 'Сумма должна быть больше 0'),
  currency: z.string().min(1, 'Выберите валюту'),
  type: z.enum(['iOwe', 'owedToMe']),
  dateTaken: z.string().min(1, 'Дата обязательна'),
  dueDate: z.string().optional(),
  purpose: z.string().optional(),
  interestRate: z.coerce.number().min(0).optional(),
  isInBudget: z.boolean().default(true),
  reminderDays: z.coerce.number().min(1).max(30).default(3)
})

type DebtFormData = z.infer<typeof debtSchema>

interface DebtFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  debt?: Debt
}

const CURRENCIES = ['KZT', 'USD', 'EUR', 'RUB']

export const DebtForm: React.FC<DebtFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  debt
}) => {
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<DebtFormData>({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      currency: DEFAULT_CURRENCY,
      type: 'iOwe',
      dateTaken: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      isInBudget: true,
      reminderDays: 3
    }
  })

  const selectedType = watch('type')
  const isInBudget = watch('isInBudget')
  const accountId = watch('accountId')

  useEffect(() => {
    if (!isOpen) return

    if (debt) {
      reset({
        contactId: debt.contactId,
        accountId: debt.accountId || '',
        amount: Number(debt.amount),
        currency: debt.currency,
        type: debt.type,
        dateTaken: format(new Date(debt.dateTaken), "yyyy-MM-dd'T'HH:mm"),
        dueDate: debt.dueDate ? format(new Date(debt.dueDate), "yyyy-MM-dd'T'HH:mm") : '',
        purpose: debt.purpose || '',
        interestRate: debt.interestRate || undefined,
        isInBudget: debt.isInBudget,
        reminderDays: debt.reminderDays || 3
      })
    } else {
      reset({
        contactId: '',
        accountId: '',
        amount: undefined,
        currency: DEFAULT_CURRENCY,
        type: 'iOwe',
        dateTaken: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        dueDate: '',
        purpose: '',
        interestRate: undefined,
        isInBudget: true,
        reminderDays: 3
      })
    }
  }, [isOpen, debt, reset])

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true)
        const [contactsRes, accountsRes] = await Promise.all([
          supabaseApi.contacts.getAll(),
          supabaseApi.accounts.getAll()
        ])
        setContacts(contactsRes)
        setAccounts(accountsRes)
      } catch {
        toast.error('Ошибка загрузки данных')
      } finally {
        setLoadingData(false)
      }
    }

    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const onSubmit = async (data: DebtFormData) => {
    try {
      setLoading(true)
      const payload = {
        contactId: data.contactId,
        accountId: data.accountId || undefined,
        amount: data.amount,
        currency: data.currency,
        type: data.type,
        dateTaken: new Date(data.dateTaken).toISOString(),
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
        purpose: data.purpose,
        interestRate: data.interestRate,
        isInBudget: data.isInBudget,
        reminderDays: data.reminderDays
      }

      if (debt) {
        await supabaseApi.debts.update(debt.id, payload)
        toast.success('Долг обновлен')
      } else {
        await supabaseApi.debts.create(payload)
        toast.success('Долг создан')
      }
      onSuccess()
      onClose()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Ошибка сохранения')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={debt ? 'Редактировать долг' : 'Новый долг'}
      size="lg"
    >
      {loadingData ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Контакт *</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...register('contactId')}
                disabled={!!debt}
              >
                <option value="">Выберите контакт</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.isFavorite ? '⭐ ' : ''}{contact.name}
                  </option>
                ))}
              </select>
              {errors.contactId && (
                <p className="mt-1 text-sm text-red-600">{errors.contactId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Валюта *</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...register('currency')}
              >
                {CURRENCIES.map((curr) => (
                  <option key={curr} value={curr}>{curr}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип долга *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setValue('type', 'owedToMe')}
                className={cn(
                  'p-3 rounded-lg border-2 transition-colors text-center',
                  selectedType === 'owedToMe'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                💰 Мне должны
              </button>
              <button
                type="button"
                onClick={() => setValue('type', 'iOwe')}
                className={cn(
                  'p-3 rounded-lg border-2 transition-colors text-center',
                  selectedType === 'iOwe'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                💳 Я должен
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Сумма *"
              type="number"
              step="0.01"
              placeholder="0.00"
              error={errors.amount?.message}
              {...register('amount')}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Счет (для бюджета)</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...register('accountId')}
              >
                <option value="">Не учитывать</option>
                {accounts.filter((a) => !a.isArchived).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.icon} {account.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата взятия *</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...register('dateTaken')}
              />
              {errors.dateTaken && (
                <p className="mt-1 text-sm text-red-600">{errors.dateTaken.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата возврата</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...register('dueDate')}
              />
            </div>
          </div>

          <Input
            label="Цель долга"
            placeholder="Например: Ремонт, покупка машины"
            error={errors.purpose?.message}
            {...register('purpose')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Процентная ставка (годовых)"
              type="number"
              step="0.1"
              placeholder="0"
              error={errors.interestRate?.message}
              {...register('interestRate')}
            />

            <Input
              label="Напоминание за N дней"
              type="number"
              placeholder="3"
              error={errors.reminderDays?.message}
              {...register('reminderDays')}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isInBudget"
              className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
              {...register('isInBudget')}
            />
            <label htmlFor="isInBudget" className="text-sm text-gray-700">
              Учитывать в бюджете (создать транзакцию)
            </label>
          </div>

          {isInBudget && !accountId && (
            <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded-lg">
              ⚠️ Выберите счет, чтобы создать транзакцию в бюджете
            </p>
          )}

          {!debt && (
            <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded-lg">
              Если у контакта уже есть активный долг того же типа, сумма будет добавлена к нему автоматически.
            </p>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Отмена
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              {debt ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
