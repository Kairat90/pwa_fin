import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, RefreshCw } from 'lucide-react'
import { supabaseApi, getErrorMessage } from '../api/supabase'
import { Debt, DebtEntryMode, DebtPayment } from '../types'
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
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null)
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const [entryMode, setEntryMode] = useState<DebtEntryMode>('repayment')
  const [editingPayment, setEditingPayment] = useState<DebtPayment | null>(null)
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

  const refreshDebtData = async (debtId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['debts'] })
    queryClient.invalidateQueries({ queryKey: ['debtStats'] })
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['contacts'] })

    if (debtId) {
      try {
        const updated = await supabaseApi.debts.getOne(debtId)
        setSelectedDebt(updated)
      } catch {
        // список обновится через invalidate
      }
    }

    await refetch()
  }

  const handleEdit = (debt: Debt) => {
    setEditingDebt(debt)
    setShowForm(true)
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

  const openEntryForm = (mode: DebtEntryMode, payment: DebtPayment | null = null) => {
    setEntryMode(mode)
    setEditingPayment(payment)
    setShowEntryForm(true)
  }

  const handleEditPayment = (payment: DebtPayment) => {
    if (payment.id.startsWith('virtual-')) {
      toast.error('Примените SQL-миграцию 20250115 для редактирования первоначального займа')
      return
    }

    const mode: DebtEntryMode =
      payment.entryType === 'increase'
        ? 'increase'
        : payment.entryType === 'initial'
          ? 'initial'
          : 'repayment'

    openEntryForm(mode, payment)
  }

  const handleDeletePayment = async (payment: DebtPayment) => {
    if (!selectedDebt) return

    if (!window.confirm('Удалить эту операцию? Связанная транзакция в бюджете тоже будет удалена.')) {
      return
    }

    try {
      await supabaseApi.debts.deletePayment(payment.id)
      toast.success('Операция удалена')
      await refreshDebtData(selectedDebt.id)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Не удалось удалить операцию')
    }
  }

  const handleWriteOff = (id: string) => {
    if (window.confirm('Списать этот долг? Операцию нельзя отменить.')) {
      writeOffMutation.mutate(id)
    }
  }

  const handleFormSuccess = () => {
    void refreshDebtData()
    setEditingDebt(null)
  }

  const handleEntrySuccess = async () => {
    await refreshDebtData(selectedDebt?.id)
    setEditingPayment(null)
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Долги</h1>
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
        <div className="space-y-3">
          {stats.byCurrency.length <= 1 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4">
                <p className="text-sm text-gray-500">Мне должны</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(stats.totalOwedToMe, stats.byCurrency[0]?.currency)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4">
                <p className="text-sm text-gray-500">Я должен</p>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(stats.totalIOwe, stats.byCurrency[0]?.currency)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4">
                <p className="text-sm text-gray-500">Чистая позиция</p>
                <p className={cn(
                  'text-xl font-bold',
                  stats.netPosition >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {formatCurrency(stats.netPosition, stats.byCurrency[0]?.currency)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4">
                <p className="text-sm text-gray-500">Просрочено</p>
                <p className="text-xl font-bold text-red-600">{stats.overdueCount}</p>
              </div>
            </div>
          ) : (
            <>
              {stats.byCurrency.map((row) => (
                <div key={row.currency} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4">
                    <p className="text-sm text-gray-500">Мне должны · {row.currency}</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(row.totalOwedToMe, row.currency)}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4">
                    <p className="text-sm text-gray-500">Я должен · {row.currency}</p>
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(row.totalIOwe, row.currency)}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4">
                    <p className="text-sm text-gray-500">Чистая позиция · {row.currency}</p>
                    <p className={cn(
                      'text-xl font-bold',
                      row.netPosition >= 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {formatCurrency(row.netPosition, row.currency)}
                    </p>
                  </div>
                </div>
              ))}
              <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4 max-w-xs">
                <p className="text-sm text-gray-500">Просрочено</p>
                <p className="text-xl font-bold text-red-600">{stats.overdueCount}</p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {(['all', 'owedToMe', 'iOwe'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                filterType === type
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              )}
            >
              {type === 'all' ? 'Все' : type === 'owedToMe' ? '💰 Мне должны' : '💳 Я должен'}
            </button>
          ))}
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex-wrap">
          {(['all', 'active', 'overdue', 'settled', 'writtenOff'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                filterStatus === status
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
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
        <div className="space-y-2">
          {debtList.map((debt) => (
            <DebtCard
              key={debt.id}
              debt={debt}
              onEdit={handleEdit}
              onDelete={handleWriteOff}
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
          <DebtDetailModal
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false)
              setSelectedDebt(null)
            }}
            debt={selectedDebt}
            onRepay={() => openEntryForm('repayment')}
            onIncrease={() => openEntryForm('increase')}
            onEditPayment={handleEditPayment}
            onDeletePayment={(payment) => void handleDeletePayment(payment)}
          />

          <DebtPaymentForm
            isOpen={showEntryForm}
            onClose={() => {
              setShowEntryForm(false)
              setEditingPayment(null)
            }}
            onSuccess={() => void handleEntrySuccess()}
            debt={selectedDebt}
            mode={entryMode}
            payment={editingPayment}
          />
        </>
      )}
    </div>
  )
}

export default DebtsPage
