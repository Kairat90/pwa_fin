import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Category } from '../../types'
import { supabaseApi, getErrorMessage } from '../../api/supabase'
import { formatCategoryOptionLabel, getCategoryDepth, getNextSortOrder, getParentOptions } from '../../utils/categoryTree'
import { cn } from '../../utils/cn'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

const categorySchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  type: z.enum(['income', 'expense']),
  parentId: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional()
})

type CategoryFormData = z.infer<typeof categorySchema>

interface CategoryFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  category?: Category
  allCategories?: Category[]
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
  category,
  allCategories: allCategoriesProp
}) => {
  const [loading, setLoading] = useState(false)
  const [allCategories, setAllCategories] = useState<Category[]>(allCategoriesProp ?? [])
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
      parentId: '',
      icon: '📁',
      color: '#6B7280'
    }
  })

  useEffect(() => {
    if (!isOpen) return

    if (allCategoriesProp?.length) {
      setAllCategories(allCategoriesProp)
    } else {
      supabaseApi.categories.getAll().then(setAllCategories).catch(() => setAllCategories([]))
    }

    if (category) {
      reset({
        name: category.name,
        type: category.type,
        parentId: category.parentId || '',
        icon: category.icon || '📁',
        color: category.color || '#6B7280'
      })
      setSelectedColor(category.color || '#6B7280')
    } else {
      reset({
        name: '',
        type: 'expense',
        parentId: '',
        icon: '📁',
        color: '#6B7280'
      })
      setSelectedColor('#6B7280')
    }
  }, [isOpen, category, reset, allCategoriesProp])

  const selectedIcon = watch('icon') || '📁'
  const selectedType = watch('type')
  const parentOptions = getParentOptions(allCategories, selectedType, category?.id)

  const onSubmit = async (data: CategoryFormData) => {
    try {
      setLoading(true)
      const payload = {
        name: data.name,
        type: data.type,
        icon: data.icon,
        color: selectedColor,
        parentId: data.parentId || null
      }

      if (category) {
        await supabaseApi.categories.update(category.id, payload)
        toast.success('Категория обновлена')
      } else {
        const sortOrder = getNextSortOrder(
          allCategories,
          data.type,
          data.parentId || null
        )
        await supabaseApi.categories.create({ ...payload, sortOrder })
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
              onClick={() => {
                setValue('type', 'expense')
                setValue('parentId', '')
              }}
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
              onClick={() => {
                setValue('type', 'income')
                setValue('parentId', '')
              }}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Родительская категория</label>
          <select
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
            {...register('parentId')}
          >
            <option value="">Без группы (верхний уровень)</option>
            {parentOptions.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {formatCategoryOptionLabel(parent, getCategoryDepth(allCategories, parent.id))}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Выберите группу, чтобы объединить категории (например: «Дом» → «Коммунальные»)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Иконка</label>
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
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
                  'w-9 h-9 sm:w-8 sm:h-8 rounded-full transition-all',
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
