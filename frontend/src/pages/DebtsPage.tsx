import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, RefreshCw } from 'lucide-react'
import { supabaseApi, getErrorMessage } from '../api/supabase'
import { Debt } from '../types'
import { DebtCard } from '../components/debts/DebtCard'
import { DebtForm } from '../components/debts/DebtForm'
import { DebtPaymentForm } from '../components/debts/DebtPaymentForm'
import { DebtDetailModal } from '../components/debts/DebtDetailModal'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { formatCurrency } from '../utils/currency'
import { cn } from '../utils/cn'

const DebtsPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null)
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'iOwe' | 'owedToMe'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'overdue' | 'settled' | 'writtenOff'>('active')
  const queryClient = useQueryClient()

  const { data: debts, isLoading, refetch } = useQuery({
    queryKey: ['debts', filterType, filterStatus],
    queryFn: () => supabaseApi.debts.getAll({
      type: filterType === 'all' ? undefined : filterType,
      status: filterStatus === 'all' ? undefined : filterStatus
    })
  })

  const { data: stats } = useQuery({
    queryKey: ['debtStats'],
    queryFn: () => supabaseApi.debts.getStats()
  })

  const writeOffMutation = useMutation({
    mutationFn: (id: string) => supabaseApi.debts.writeOff(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] })
      queryClient.invalidateQueries({ queryKey: ['debtStats'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      toast.success('Долг списан')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Ошибка списания')
    }
  })

  const checkOverdueMutation = useMutation({
    mutationFn: () => supabaseApi.debts.checkOverdue(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['debts'] })
      queryClient.invalidateQueries({ queryKey: ['debtStats'] })
      toast.success(res.message || 'Проверка выполнена')
      refetch()
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Ошибка проверки')
    }
  })

  const handleEdit = (debt: Debt) => {
    setEditingDebt(debt)
    setShowForm(true)
  }

  const handleAddPayment = (debt: Debt) => {
    setSelectedDebt(debt)
    setShowPaymentForm(true)
  }

  const handleViewDetails = async (debt: Debt) => {
    try {
      const data = await supabaseApi.debts.getOne(debt.id)
      setSelectedDebt(data)
      setShowDetailModal(true)
    } catch {
      toast.error('Не удалось загрузить детали долга')
    }
  }

  const handleWriteOff = (id: string) => {
    if (window.confirm('Списать этот долг? Операцию нельзя отменить.')) {
      writeOffMutation.mutate(id)
    }
  }

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['debts'] })
    queryClient.invalidateQueries({ queryKey: ['debtStats'] })
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['contacts'] })
    setEditingDebt(null)
  }

  const handlePaymentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['debts'] })
    queryClient.invalidateQueries({ queryKey: ['debtStats'] })
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    setSelectedDebt(null)
    refetch()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const debtList = debts || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Долги</h1>
          <p className="text-gray-500 text-sm">{debtList.length} долгов</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkOverdueMutation.mutate()}
            loading={checkOverdueMutation.isPending}
            className="flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Проверить просрочки
          </Button>
          <Button
            onClick={() => {
              setEditingDebt(null)
              setShowForm(true)
            }}
            className="flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Новый долг
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Мне должны</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(stats.totalOwedToMe)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Я должен</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(stats.totalIOwe)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Чистая позиция</p>
            <p className={cn(
              'text-xl font-bold',
              stats.netPosition >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {formatCurrency(stats.netPosition)}
            </p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Просрочено</p>
            <p className="text-xl font-bold text-red-600">{stats.overdueCount}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-gray-100 rounded-lg p-1">
          {(['all', 'owedToMe', 'iOwe'] as const).map((type) => (
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
              {type === 'all' ? 'Все' : type === 'owedToMe' ? '💰 Мне должны' : '💳 Я должен'}
            </button>
          ))}
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1 flex-wrap">
          {(['all', 'active', 'overdue', 'settled', 'writtenOff'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                filterStatus === status
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {status === 'all' ? 'Все'
                : status === 'active' ? 'Активные'
                  : status === 'overdue' ? 'Просроченные'
                    : status === 'settled' ? 'Погашенные' : 'Списанные'}
            </button>
          ))}
        </div>
      </div>

      {debtList.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">Нет долгов</p>
          <p className="text-gray-400 text-sm mt-1">
            {filterStatus !== 'all' ? 'Попробуйте изменить фильтр' : 'Создайте первый долг'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {debtList.map((debt) => (
            <DebtCard
              key={debt.id}
              debt={debt}
              onEdit={handleEdit}
              onDelete={handleWriteOff}
              onAddPayment={handleAddPayment}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}

      <DebtForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false)
          setEditingDebt(null)
        }}
        onSuccess={handleFormSuccess}
        debt={editingDebt || undefined}
      />

      {selectedDebt && (
        <>
          <DebtPaymentForm
            isOpen={showPaymentForm}
            onClose={() => {
              setShowPaymentForm(false)
            }}
            onSuccess={handlePaymentSuccess}
            debt={selectedDebt}
          />

          <DebtDetailModal
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false)
              setSelectedDebt(null)
            }}
            debt={selectedDebt}
          />
        </>
      )}
    </div>
  )
}

export default DebtsPage
