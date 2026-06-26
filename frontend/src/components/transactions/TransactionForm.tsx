import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Transaction, Account, Category } from '../../types'
import { supabaseApi, getErrorMessage } from '../../api/supabase'
import { formatCurrency } from '../../utils/currency'
import { cn } from '../../utils/cn'
import { buildCategoryTree, flattenCategoryTree, formatCategoryOptionLabel } from '../../utils/categoryTree'
import { dateInputToIso, toDateInputValue } from '../../utils/dateInput'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

const transactionSchema = z.object({
  accountId: z.string().min(1, 'Выберите счет'),
  categoryId: z.string().min(1, 'Выберите категорию'),
  amount: z.coerce.number().min(0.01, 'Сумма должна быть больше 0'),
  date: z.string().min(1, 'Дата обязательна'),
  note: z.string().optional(),
  tags: z.string().optional(),
  isExcludedFromBudget: z.boolean().default(false)
})

type TransactionFormData = z.infer<typeof transactionSchema>

interface TransactionFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  type: 'income' | 'expense'
  transaction?: Transaction
  /** Повтор операции: те же поля, новая дата, создаёт новую запись */
  repeatSource?: Transaction
  defaultAccountId?: string
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  type,
  transaction,
  repeatSource,
  defaultAccountId
}) => {
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      accountId: defaultAccountId || '',
      date: toDateInputValue(),
      isExcludedFromBudget: false
    }
  })

  useEffect(() => {
    if (!isOpen) return

    if (transaction) {
      reset({
        accountId: transaction.accountId,
        categoryId: transaction.categoryId || '',
        amount: Math.abs(Number(transaction.amount)),
        date: toDateInputValue(transaction.date),
        note: transaction.note || '',
        tags: transaction.tags.join(', '),
        isExcludedFromBudget: transaction.isExcludedFromBudget || false
      })
    } else if (repeatSource) {
      reset({
        accountId: repeatSource.accountId,
        categoryId: repeatSource.categoryId || '',
        amount: Math.abs(Number(repeatSource.amount)),
        date: toDateInputValue(),
        note: repeatSource.note || '',
        tags: repeatSource.tags.filter((t) => t !== 'transfer').join(', '),
        isExcludedFromBudget: repeatSource.isExcludedFromBudget || false
      })
    } else {
      reset({
        accountId: defaultAccountId || '',
        categoryId: '',
        amount: undefined,
        date: toDateInputValue(),
        note: '',
        tags: '',
        isExcludedFromBudget: false
      })
    }
  }, [isOpen, transaction, repeatSource, defaultAccountId, reset])

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true)
        const [accountsRes, categoriesRes] = await Promise.all([
          supabaseApi.accounts.getAll(),
          supabaseApi.categories.getAll(type)
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
  }, [isOpen, type])

  const onSubmit = async (data: TransactionFormData) => {
    try {
      setLoading(true)
      const payload = {
        accountId: data.accountId,
        categoryId: data.categoryId,
        amount: data.amount,
        date: dateInputToIso(data.date),
        note: data.note,
        tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        isExcludedFromBudget: data.isExcludedFromBudget
      }

      if (transaction) {
        const signedAmount = type === 'expense' ? -Math.abs(data.amount) : Math.abs(data.amount)
        await supabaseApi.transactions.update(transaction.id, { ...payload, amount: signedAmount })
        toast.success('Транзакция обновлена')
      } else if (type === 'income') {
        await supabaseApi.transactions.createIncome(payload)
        toast.success('Транзакция создана')
      } else {
        await supabaseApi.transactions.createExpense(payload)
        toast.success('Транзакция создана')
      }
      onSuccess()
      onClose()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Ошибка сохранения')
    } finally {
      setLoading(false)
    }
  }

  const categoryOptions = flattenCategoryTree(buildCategoryTree(categories))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        transaction
          ? 'Редактировать'
          : repeatSource
            ? 'Повторить операцию'
            : type === 'income'
              ? 'Новый доход'
              : 'Новый расход'
      }
      size="lg"
    >
      {loadingData ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 min-w-0">
          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Счет</label>
            <select
              className="w-full min-w-0 max-w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 sm:px-4 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              {...register('accountId')}
            >
              <option value="">Выберите счет</option>
              {accounts.filter((a) => !a.isArchived).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.icon} {account.name} ({formatCurrency(Number(account.balance ?? account.initialBalance), account.currency)})
                </option>
              ))}
            </select>
            {errors.accountId && (
              <p className="mt-1 text-sm text-red-600">{errors.accountId.message}</p>
            )}
          </div>

          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
            <select
              className="w-full min-w-0 max-w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 sm:px-4 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              {...register('categoryId')}
            >
              <option value="">Выберите категорию</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {formatCategoryOptionLabel(category, category.depth)}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="mt-1 text-sm text-red-600">{errors.categoryId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
            <Input
              label="Сумма"
              type="number"
              step="0.01"
              placeholder="0.00"
              inputMode="decimal"
              className="min-w-0"
              error={errors.amount?.message}
              {...register('amount')}
            />
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
              <input
                type="date"
                className="w-full min-w-0 max-w-full box-border rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 sm:px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
                {...register('date')}
              />
              {errors.date && (
                <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
              )}
            </div>
          </div>

          <Input
            label="Примечание (опционально)"
            placeholder="Например: Обед в кафе"
            error={errors.note?.message}
            {...register('note')}
          />

          <Input
            label="Теги (через запятую)"
            placeholder="еда, работа, срочно"
            error={errors.tags?.message}
            {...register('tags')}
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="excludeFromBudget"
              className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
              {...register('isExcludedFromBudget')}
            />
            <label htmlFor="excludeFromBudget" className="text-sm text-gray-700">
              Исключить из бюджета (не влияет на статистику)
            </label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 w-full">
              Отмена
            </Button>
            <Button
              type="submit"
              loading={loading}
              className={cn(
                'flex-1 w-full',
                type === 'income' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              )}
            >
              {transaction ? 'Сохранить' : repeatSource ? 'Повторить' : type === 'income' ? 'Добавить доход' : 'Добавить расход'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
