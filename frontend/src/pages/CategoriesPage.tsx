import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, RefreshCw } from 'lucide-react'
import { supabaseApi, getErrorMessage } from '../api/supabase'
import { Category } from '../types'
import { getSiblingMoveFlags, splitCategoriesByType } from '../utils/categoryTree'
import { CategoryCard } from '../components/categories/CategoryCard'
import { CategoryForm } from '../components/categories/CategoryForm'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/common/LoadingSpinner'

interface CategoryColumnProps {
  title: string
  emoji: string
  accentClass: string
  items: Array<Category & { depth: number }>
  allCategories: Category[]
  onEdit: (category: Category) => void
  onDelete: (id: string) => void
  onMove: (id: string, direction: 'up' | 'down') => void
  isMoving: boolean
}

const CategoryColumn: React.FC<CategoryColumnProps> = ({
  title,
  emoji,
  accentClass,
  items,
  allCategories,
  onEdit,
  onDelete,
  onMove,
  isMoving
}) => (
  <section className="flex flex-col min-h-0">
    <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${accentClass}`}>
      <span className="text-xl">{emoji}</span>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <span className="text-sm text-gray-400 ml-auto">{items.length}</span>
    </div>

    {items.length > 0 ? (
      <div className="space-y-2">
        {items.map((category) => {
          const { canMoveUp, canMoveDown } = getSiblingMoveFlags(allCategories, category.id)

          return (
            <CategoryCard
              key={category.id}
              category={category}
              depth={category.depth}
              canMoveUp={canMoveUp && !isMoving}
              canMoveDown={canMoveDown && !isMoving}
              onEdit={onEdit}
              onDelete={onDelete}
              onMoveUp={(id) => onMove(id, 'up')}
              onMoveDown={(id) => onMove(id, 'down')}
            />
          )
        })}
      </div>
    ) : (
      <p className="text-gray-400 text-sm py-8 text-center">Нет категорий</p>
    )}
  </section>
)

const CategoriesPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const queryClient = useQueryClient()

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => supabaseApi.categories.getAll()
  })

  const { income, expense } = useMemo(() => {
    if (!categories?.length) {
      return { income: [], expense: [] }
    }
    return splitCategoriesByType(categories)
  }, [categories])

  const initMutation = useMutation({
    mutationFn: () => supabaseApi.categories.init(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Категории по умолчанию загружены')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Ошибка загрузки')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => supabaseApi.categories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Категория удалена')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Ошибка удаления')
    }
  })

  const reorderMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
      supabaseApi.categories.reorder(id, direction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Ошибка изменения порядка')
    }
  })

  const openCreateForm = () => {
    setEditingCategory(null)
    setShowForm(true)
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setShowForm(true)
  }

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    setEditingCategory(null)
  }

  const handleMove = (id: string, direction: 'up' | 'down') => {
    reorderMutation.mutate({ id, direction })
  }

  const hasCategories = (categories?.length ?? 0) > 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Категории</h1>
          <p className="text-gray-500 text-sm">
            {categories?.length || 0} категорий · доходы слева, расходы справа
          </p>
        </div>

        <div className="hidden md:flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => initMutation.mutate()}
            loading={initMutation.isPending}
            className="flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Загрузить по умолчанию
          </Button>
          <Button onClick={openCreateForm} className="flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Новая категория
          </Button>
        </div>
      </div>

      {hasCategories ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <CategoryColumn
            title="Доходы"
            emoji="💰"
            accentClass="border-green-400"
            items={income}
            allCategories={categories ?? []}
            onEdit={handleEdit}
            onDelete={deleteMutation.mutate}
            onMove={handleMove}
            isMoving={reorderMutation.isPending}
          />
          <CategoryColumn
            title="Расходы"
            emoji="💸"
            accentClass="border-red-400"
            items={expense}
            allCategories={categories ?? []}
            onEdit={handleEdit}
            onDelete={deleteMutation.mutate}
            onMove={handleMove}
            isMoving={reorderMutation.isPending}
          />
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">Нет категорий</p>
          <p className="text-gray-400 text-sm mt-1">
            Загрузите набор по умолчанию или создайте свою категорию
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4 px-4">
            <Button onClick={openCreateForm} className="w-full sm:w-auto">
              Создать категорию
            </Button>
            <Button
              variant="outline"
              onClick={() => initMutation.mutate()}
              loading={initMutation.isPending}
              className="w-full sm:w-auto"
            >
              Загрузить по умолчанию
            </Button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={openCreateForm}
        className="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Новая категория"
      >
        <Plus className="w-6 h-6" />
      </button>

      <CategoryForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false)
          setEditingCategory(null)
        }}
        onSuccess={handleFormSuccess}
        category={editingCategory || undefined}
        allCategories={categories}
      />
    </div>
  )
}

export default CategoriesPage
