import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
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
    startDate: searchParams.get('startDate') || format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: searchParams.get('endDate') || format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    accountId: searchParams.get('accountId') || '',
    categoryId: searchParams.get('categoryId') || '',
    type: (searchParams.get('type') as 'income' | 'expense') || '',
    search: searchParams.get('search') || ''
  }

  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => supabaseApi.transactions.getAll({
      startDate: filters.startDate,
      endDate: filters.endDate,
      accountId: filters.accountId || undefined,
      categoryId: filters.categoryId || undefined,
      type: filters.type || undefined,
      search: filters.search || undefined
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
    const params: Record<string, string> = {
      startDate: newFilters.startDate || format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      endDate: newFilters.endDate || format(endOfMonth(new Date()), 'yyyy-MM-dd')
    }

    if (newFilters.accountId) params.accountId = newFilters.accountId
    if (newFilters.categoryId) params.categoryId = newFilters.categoryId
    if (newFilters.type) params.type = newFilters.type
    if (newFilters.search) params.search = newFilters.search

    setSearchParams(params)
  }

  const handleResetFilters = () => {
    setSearchParams({
      startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Транзакции</h1>
          <p className="text-gray-500 text-sm">
            {transactionsData?.data?.length || 0} транзакций
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEditingTransaction(null)
              setRepeatSource(null)
              setFormType('expense')
              setShowForm(true)
            }}
            className="bg-red-600 hover:bg-red-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            Расход
          </Button>
          <Button
            onClick={() => {
              setEditingTransaction(null)
              setRepeatSource(null)
              setFormType('income')
              setShowForm(true)
            }}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            Доход
          </Button>
        </div>
      </div>

      {accounts && categories && (
        <TransactionFilters
          accounts={accounts}
          categories={categories}
          onFilter={handleFilter}
          onReset={handleResetFilters}
          initialFilters={filters}
        />
      )}

      <TransactionList
        transactions={transactionsData?.data || []}
        onEdit={handleEdit}
        onDelete={deleteMutation.mutate}
        onRepeat={handleRepeat}
        loading={isLoading}
      />

      <TransactionForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false)
          setEditingTransaction(null)
          setRepeatSource(null)
        }}
        onSuccess={handleFormSuccess}
        type={formType}
        transaction={editingTransaction || undefined}
        repeatSource={repeatSource || undefined}
        defaultAccountId={defaultAccount?.id}
      />
    </div>
  )
}

export default TransactionsPage
