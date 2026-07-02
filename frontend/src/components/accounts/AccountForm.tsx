import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Account } from '../../types'
import { supabaseApi, getErrorMessage } from '../../api/supabase'
import { useAuth } from '../../context/AuthContext'
import { DEFAULT_CURRENCY } from '../../utils/currency'
import { cn } from '../../utils/cn'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

const accountSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  currency: z.string().min(1, 'Валюта обязательна'),
  initialBalance: z.coerce.number().min(0, 'Баланс не может быть отрицательным'),
  icon: z.string().optional(),
  color: z.string().optional(),
  type: z.enum(['cash', 'card', 'investment', 'savings']).default('cash')
})

type AccountFormData = z.infer<typeof accountSchema>

interface AccountFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  account?: Account
}

const CURRENCIES = ['KZT', 'USD', 'EUR', 'RUB']
const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Наличные' },
  { value: 'card', label: 'Карта' },
  { value: 'investment', label: 'Инвестиции' },
  { value: 'savings', label: 'Накопления' }
]
const ICONS = ['💰', '💳', '🏦', '💎', '🏠', '🚗', '📈', '💵']

export const AccountForm: React.FC<AccountFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  account
}) => {
  const [loading, setLoading] = useState(false)
  const [selectedColor, setSelectedColor] = useState(account?.color || '#4F46E5')
  const { defaultAccountId, refreshProfile, setUserProfile } = useAuth()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      currency: DEFAULT_CURRENCY,
      initialBalance: 0,
      icon: '💰',
      type: 'cash',
      color: '#4F46E5'
    }
  })

  useEffect(() => {
    if (isOpen) {
      if (account) {
        reset({
          name: account.name,
          currency: account.currency,
          initialBalance: Number(account.initialBalance),
          icon: account.icon || '💰',
          type: (account.type as AccountFormData['type']) || 'cash',
          color: account.color || '#4F46E5'
        })
        setSelectedColor(account.color || '#4F46E5')
      } else {
        reset({
          name: '',
          currency: DEFAULT_CURRENCY,
          initialBalance: 0,
          icon: '💰',
          type: 'cash',
          color: '#4F46E5'
        })
        setSelectedColor('#4F46E5')
      }
    }
  }, [isOpen, account, reset])

  const selectedIcon = watch('icon') || '💰'

  const onSubmit = async (data: AccountFormData) => {
    try {
      setLoading(true)
      const payload = {
        ...data,
        color: selectedColor,
        initialBalance: Number(data.initialBalance)
      }

      if (account) {
        await supabaseApi.accounts.update(account.id, payload)
        toast.success('Счет обновлен')
      } else {
        const created = await supabaseApi.accounts.create(payload)
        toast.success('Счет создан')

        if (!defaultAccountId) {
          await supabaseApi.accounts.setDefault(created.id)
          const profile = await supabaseApi.auth.fetchProfile()
          if (profile) {
            setUserProfile(profile)
          } else {
            await refreshProfile()
          }
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={account ? 'Редактировать счет' : 'Новый счет'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Название счета"
          placeholder="Например: Карта Kaspi"
          error={errors.name?.message}
          {...register('name')}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Валюта</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              {...register('currency')}
            >
              {CURRENCIES.map((curr) => (
                <option key={curr} value={curr}>{curr}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип счета</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              {...register('type')}
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label="Начальный баланс"
          type="number"
          step="0.01"
          placeholder="0"
          error={errors.initialBalance?.message}
          {...register('initialBalance')}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Иконка</label>
          <div className="grid grid-cols-8 gap-2">
            {ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => setValue('icon', icon)}
                className={cn(
                  'w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-colors',
                  selectedIcon === icon
                    ? 'bg-primary-100 ring-2 ring-primary-500'
                    : 'bg-gray-50 hover:bg-gray-100'
                )}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Цвет</label>
          <div className="flex gap-2 flex-wrap">
            {[
              '#4F46E5', '#10B981', '#F59E0B', '#EF4444',
              '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
              '#6B7280', '#1F2937'
            ].map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setSelectedColor(color)}
                className={cn(
                  'w-8 h-8 rounded-full transition-all',
                  selectedColor === color
                    ? 'ring-2 ring-primary-500 ring-offset-2'
                    : 'hover:scale-110'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Отмена
          </Button>
          <Button type="submit" loading={loading} className="flex-1">
            {account ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
