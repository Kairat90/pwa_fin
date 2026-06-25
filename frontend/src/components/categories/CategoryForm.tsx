import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Category } from '../../types'
import { supabaseApi, getErrorMessage } from '../../api/supabase'
import { cn } from '../../utils/cn'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

const categorySchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  type: z.enum(['income', 'expense']),
  icon: z.string().optional(),
  color: z.string().optional()
})

type CategoryFormData = z.infer<typeof categorySchema>

interface CategoryFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  category?: Category
}

const ICONS = [
  '🍕', '🛒', '🚗', '🏠', '💡', '📱', '🎮', '📚',
  '🏥', '💊', '✈️', '🎬', '🍔', '☕', '🎵', '🎨',
  '💻', '📦', '🏋️', '🧘', '👕', '💄', '🎁', '🏷️'
]

export const CategoryForm: React.FC<CategoryFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  category
}) => {
  const [loading, setLoading] = useState(false)
  const [selectedColor, setSelectedColor] = useState(category?.color || '#6B7280')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      type: 'expense',
      icon: '📁',
      color: '#6B7280'
    }
  })

  useEffect(() => {
    if (isOpen) {
      if (category) {
        reset({
          name: category.name,
          type: category.type,
          icon: category.icon || '📁',
          color: category.color || '#6B7280'
        })
        setSelectedColor(category.color || '#6B7280')
      } else {
        reset({
          name: '',
          type: 'expense',
          icon: '📁',
          color: '#6B7280'
        })
        setSelectedColor('#6B7280')
      }
    }
  }, [isOpen, category, reset])

  const selectedIcon = watch('icon') || '📁'
  const selectedType = watch('type')

  const onSubmit = async (data: CategoryFormData) => {
    try {
      setLoading(true)
      const payload = {
        ...data,
        color: selectedColor
      }

      if (category) {
        await supabaseApi.categories.update(category.id, payload)
        toast.success('Категория обновлена')
      } else {
        await supabaseApi.categories.create(payload)
        toast.success('Категория создана')
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
    <Modal isOpen={isOpen} onClose={onClose} title={category ? 'Редактировать категорию' : 'Новая категория'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Название категории"
          placeholder="Например: Продукты"
          error={errors.name?.message}
          {...register('name')}
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
              '#6B7280', '#EF4444', '#F59E0B', '#10B981',
              '#4F46E5', '#8B5CF6', '#EC4899', '#14B8A6',
              '#F97316', '#1F2937'
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
            {category ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
