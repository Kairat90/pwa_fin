import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, RefreshCw } from 'lucide-react'
import { supabaseApi, getErrorMessage } from '../api/supabase'
import { Category } from '../types'
import { splitCategoryTreesByType } from '../utils/categoryTree'
import { CategoryTreeList } from '../components/categories/CategoryTreeList'
import { CategoryForm } from '../components/categories/CategoryForm'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/common/LoadingSpinner'

interface CategoryColumnProps {
  title: string
  emoji: string
  accentClass: string
  trees: Category[]
  allCategories: Category[]
  collapsedIds: Set<string>
  onToggleCollapse: (id: string) => void
  onEdit: (category: Category) => void
  onDelete: (id: string) => void
  onMove: (id: string, direction: 'up' | 'down') => void
  isMoving: boolean
}

const CategoryColumn: React.FC<CategoryColumnProps> = ({
  title,
  emoji,
  accentClass,
  trees,
  allCategories,
  collapsedIds,
  onToggleCollapse,
  onEdit,
  onDelete,
  onMove,
  isMoving
}) => {
  const count = useMemo(() => {
    const walk = (nodes: Category[]): number =>
      nodes.reduce((sum, n) => sum + 1 + walk(n.children ?? []), 0)
    return walk(trees)
  }, [trees])

  return (
    <section className="flex flex-col min-h-0">
      <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${accentClass}`}>
        <span className="text-base">{emoji}</span>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <span className="text-xs text-gray-400 ml-auto">{count}</span>
      </div>

      {trees.length > 0 ? (
        <CategoryTreeList
          nodes={trees}
          allCategories={allCategories}
          collapsedIds={collapsedIds}
          onToggleCollapse={onToggleCollapse}
          onEdit={onEdit}
          onDelete={onDelete}
          onMove={onMove}
          isMoving={isMoving}
        />
      ) : (
        <p className="text-gray-400 text-sm py-8 text-center">Нет категорий</p>
      )}
    </section>
  )
}

const CategoriesPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const expandedByUserRef = useRef(new Set<string>())
  const queryClient = useQueryClient()

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => supabaseApi.categories.getAll()
  })

  const { income, expense } = useMemo(() => {
    if (!categories?.length) {
      return { income: [], expense: [] }
    }
    return splitCategoryTreesByType(categories)
  }, [categories])

  const parentIdsKey = useMemo(() => {
    if (!categories?.length) return ''
    return categories
      .filter((c) => categories.some((ch) => ch.parentId === c.id))
      .map((c) => c.id)
      .sort()
      .join(',')
  }, [categories])

  // Родители свёрнуты по умолчанию; сохраняем ручное разворачивание
  useLayoutEffect(() => {
    if (!parentIdsKey) return

    const parentIds = parentIdsKey.split(',').filter(Boolean)
    const validIds = new Set(categories?.map((c) => c.id) ?? [])
    expandedByUserRef.current = new Set(
      [...expandedByUserRef.current].filter((id) => validIds.has(id))
    )

    setCollapsedIds((prev) => {
      const next = new Set(prev)
      let changed = false

      for (const id of parentIds) {
        if (!prev.has(id) && !expandedByUserRef.current.has(id)) {
          next.add(id)
          changed = true
        }
      }

      for (const id of prev) {
        if (!parentIds.includes(id)) {
          next.delete(id)
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [parentIdsKey, categories])

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        expandedByUserRef.current.add(id)
      } else {
        next.add(id)
        expandedByUserRef.current.delete(id)
      }
      return next
    })
  }

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
            {categories?.length || 0} категорий · нажмите ▶ чтобы развернуть группу
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
            trees={income}
            allCategories={categories ?? []}
            collapsedIds={collapsedIds}
            onToggleCollapse={toggleCollapse}
            onEdit={handleEdit}
            onDelete={deleteMutation.mutate}
            onMove={handleMove}
            isMoving={reorderMutation.isPending}
          />
          <CategoryColumn
            title="Расходы"
            emoji="💸"
            accentClass="border-red-400"
            trees={expense}
            allCategories={categories ?? []}
            collapsedIds={collapsedIds}
            onToggleCollapse={toggleCollapse}
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
