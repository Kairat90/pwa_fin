import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, RefreshCw } from 'lucide-react'
import { supabaseApi, getErrorMessage } from '../api/supabase'
import { ScheduledTransaction } from '../types'
import { ScheduledCard } from '../components/scheduled/ScheduledCard'
import { ScheduledForm } from '../components/scheduled/ScheduledForm'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { cn } from '../utils/cn'

const ScheduledPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false)
  const [editingScheduled, setEditingScheduled] = useState<ScheduledTransaction | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [showActive, setShowActive] = useState<boolean | undefined>(true)
  const queryClient = useQueryClient()

  const { data: scheduledList, isLoading, refetch } = useQuery({
    queryKey: ['scheduled', filterType, showActive],
    queryFn: () => supabaseApi.scheduled.getAll({
      type: filterType === 'all' ? undefined : filterType,
      isActive: showActive
    })
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => supabaseApi.scheduled.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled'] })
      toast.success('Операция удалена')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Ошибка удаления')
    }
  })

  const processMutation = useMutation({
    mutationFn: () => supabaseApi.scheduled.process(),
    onSuccess: (results) => {
      const count = results?.length ?? 0
      toast.success(count > 0 ? `Обработано ${count} операций` : 'Нет операций для выполнения')
      queryClient.invalidateQueries({ queryKey: ['scheduled'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      refetch()
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Ошибка процессинга')
    }
  })

  const handleEdit = (item: ScheduledTransaction) => {
    setEditingScheduled(item)
    setShowForm(true)
  }

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['scheduled'] })
    setEditingScheduled(null)
  }

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['scheduled'] })
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    refetch()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const scheduledItems = scheduledList || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Запланированные операции</h1>
          <p className="text-gray-500 text-sm">
            {scheduledItems.length} операций
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => processMutation.mutate()}
            loading={processMutation.isPending}
            className="flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Проверить
          </Button>
          <Button
            onClick={() => {
              setEditingScheduled(null)
              setShowForm(true)
            }}
            className="flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Новая
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-gray-100 rounded-lg p-1">
          {(['all', 'expense', 'income'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                filterType === type
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {type === 'all' ? 'Все' : type === 'expense' ? '💸 Расходы' : '💰 Доходы'}
            </button>
          ))}
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setShowActive(true)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg transition-colors',
              showActive === true
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Активные
          </button>
          <button
            type="button"
            onClick={() => setShowActive(false)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg transition-colors',
              showActive === false
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Неактивные
          </button>
          <button
            type="button"
            onClick={() => setShowActive(undefined)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg transition-colors',
              showActive === undefined
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Все
          </button>
        </div>
      </div>

      {scheduledItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">Нет запланированных операций</p>
          <p className="text-gray-400 text-sm mt-1">
            Создайте первую операцию для автоматизации
          </p>
          <Button
            onClick={() => {
              setEditingScheduled(null)
              setShowForm(true)
            }}
            className="mt-4"
          >
            Создать операцию
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {scheduledItems.map((item) => (
            <ScheduledCard
              key={item.id}
              scheduled={item}
              onEdit={handleEdit}
              onDelete={deleteMutation.mutate}
              onSuccess={handleSuccess}
            />
          ))}
        </div>
      )}

      <ScheduledForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false)
          setEditingScheduled(null)
        }}
        onSuccess={handleFormSuccess}
        scheduled={editingScheduled || undefined}
      />
    </div>
  )
}

export default ScheduledPage
