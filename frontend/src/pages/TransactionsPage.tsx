import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import { supabaseApi, getErrorMessage } from '../api/supabase'
import { useAuth } from '../context/AuthContext'
import { Transaction } from '../types'
import { resolveDefaultAccount } from '../utils/defaultAccount'
import { TransactionList } from '../components/transactions/TransactionList'
import { TransactionForm } from '../components/transactions/TransactionForm'
import { TransactionFilters, TransactionFilterValues } from '../components/transactions/TransactionFilters'
import { Button } from '../components/ui/Button'

const TransactionsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showForm, setShowForm] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [repeatSource, setRepeatSource] = useState<Transaction | null>(null)
  const [formType, setFormType] = useState<'income' | 'expense'>('expense')

  const queryClient = useQueryClient()
  const { defaultAccountId, defaultCurrency } = useAuth()

  const filters = {
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    accountId: searchParams.get('accountId') || '',
    categoryId: searchParams.get('categoryId') || '',
    type: (searchParams.get('type') as 'income' | 'expense') || '',
    search: searchParams.get('search') || ''
  }

  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () =>
      supabaseApi.transactions.getAll({
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        accountId: filters.accountId || undefined,
        categoryId: filters.categoryId || undefined,
        type: filters.type || undefined,
        search: filters.search || undefined,
        // Без дат и с поиском — шире выборка, чтобы искать по всем операциям
        limit: filters.search && !filters.startDate && !filters.endDate ? 5000 : undefined
      })
  })

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => supabaseApi.accounts.getAll()
  })

  const defaultAccount = resolveDefaultAccount(accounts ?? [], defaultAccountId, defaultCurrency)

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => supabaseApi.categories.getAll()
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => supabaseApi.transactions.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('Транзакция удалена')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Ошибка удаления')
    }
  })

  const handleEdit = (transaction: Transaction) => {
    setRepeatSource(null)
    setEditingTransaction(transaction)
    setFormType(Number(transaction.amount) > 0 ? 'income' : 'expense')
    setShowForm(true)
  }

  const handleRepeat = (transaction: Transaction) => {
    setEditingTransaction(null)
    setRepeatSource(transaction)
    setFormType(Number(transaction.amount) > 0 ? 'income' : 'expense')
    setShowForm(true)
  }

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    setEditingTransaction(null)
    setRepeatSource(null)
  }

  const handleFilter = (newFilters: TransactionFilterValues) => {
    const params: Record<string, string> = {}

    if (newFilters.startDate) params.startDate = newFilters.startDate
    if (newFilters.endDate) params.endDate = newFilters.endDate
    if (newFilters.accountId) params.accountId = newFilters.accountId
    if (newFilters.categoryId) params.categoryId = newFilters.categoryId
    if (newFilters.type) params.type = newFilters.type
    if (newFilters.search) params.search = newFilters.search

    setSearchParams(params)
  }

  const handleResetFilters = () => {
    setSearchParams({})
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Транзакции</h1>
          <p className="text-gray-500 text-sm">
            {transactionsData?.data?.length || 0} транзакций
            {!filters.startDate && !filters.endDate ? ' · все периоды' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setFormType('income')
              setEditingTransaction(null)
              setRepeatSource(null)
              setShowForm(true)
            }}
            variant="secondary"
            className="flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Доход
          </Button>
          <Button
            onClick={() => {
              setFormType('expense')
              setEditingTransaction(null)
              setRepeatSource(null)
              setShowForm(true)
            }}
            className="flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Расход
          </Button>
        </div>
      </div>

      <TransactionFilters
        accounts={accounts || []}
        categories={categories || []}
        onFilter={handleFilter}
        onReset={handleResetFilters}
        initialFilters={filters}
      />

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Загрузка...</div>
      ) : (
        <TransactionList
          transactions={transactionsData?.data || []}
          onEdit={handleEdit}
          onRepeat={handleRepeat}
          onDelete={(id) => {
            if (window.confirm('Удалить транзакцию?')) {
              deleteMutation.mutate(id)
            }
          }}
        />
      )}

      <TransactionForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false)
          setEditingTransaction(null)
          setRepeatSource(null)
        }}
        onSuccess={handleFormSuccess}
        transaction={editingTransaction}
        repeatSource={repeatSource}
        type={formType}
        defaultAccountId={defaultAccount?.id}
      />
    </div>
  )
}

export default TransactionsPage
