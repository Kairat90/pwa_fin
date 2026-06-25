import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, RefreshCw } from 'lucide-react'
import { supabaseApi, getErrorMessage } from '../api/supabase'
import { Category } from '../types'
import { buildCategoryTree, flattenCategoryTree } from '../utils/categoryTree'
import { CategoryCard } from '../components/categories/CategoryCard'
import { CategoryForm } from '../components/categories/CategoryForm'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { cn } from '../utils/cn'

const CategoriesPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const queryClient = useQueryClient()

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories', filterType],
    queryFn: () => supabaseApi.categories.getAll(
      filterType === 'all' ? undefined : filterType
    )
  })

  const flatCategories = useMemo(() => {
    if (!categories?.length) return []
    return flattenCategoryTree(buildCategoryTree(categories))
  }, [categories])

  const initMutation = useMutation({
    mutationFn: () => supabaseApi.categories.init(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Системные категории созданы')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Ошибка инициализации')
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Категории</h1>
          <p className="text-gray-500 text-sm">
            {categories?.length || 0} категорий
          </p>
        </div>

        <div className="flex bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
          {(['all', 'expense', 'income'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={cn(
                'flex-1 sm:flex-none px-3 py-2 text-sm rounded-lg transition-colors',
                filterType === type
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {type === 'all' ? 'Все' : type === 'expense' ? '💸 Расходы' : '💰 Доходы'}
            </button>
          ))}
        </div>

        <div className="hidden md:flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => initMutation.mutate()}
            loading={initMutation.isPending}
            className="flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Системные
          </Button>
          <Button onClick={openCreateForm} className="flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Новая категория
          </Button>
        </div>
      </div>

      {flatCategories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {flatCategories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              depth={category.depth}
              onEdit={handleEdit}
              onDelete={deleteMutation.mutate}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">Нет категорий</p>
          <p className="text-gray-400 text-sm mt-1">
            Создайте первую категорию или инициализируйте системные
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
              Создать системные
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
      />
    </div>
  )
}

export default CategoriesPage
