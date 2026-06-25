import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Filter } from 'lucide-react'
import { supabaseApi, getErrorMessage } from '../api/supabase'
import { Account } from '../types'
import { AccountCard } from '../components/accounts/AccountCard'
import { AccountForm } from '../components/accounts/AccountForm'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/common/LoadingSpinner'

const AccountsPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const queryClient = useQueryClient()

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts', showArchived],
    queryFn: () => supabaseApi.accounts.getAll(showArchived)
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => supabaseApi.accounts.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('Счет архивирован')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Ошибка архивации')
    }
  })

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => supabaseApi.accounts.unarchive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('Счет восстановлен')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Ошибка восстановления')
    }
  })

  const handleEdit = (account: Account) => {
    setEditingAccount(account)
    setShowForm(true)
  }

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    setEditingAccount(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const activeAccounts = accounts?.filter((a) => !a.isArchived) || []
  const archivedAccounts = accounts?.filter((a) => a.isArchived) || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Счета</h1>
          <p className="text-gray-500 text-sm">
            {activeAccounts.length} активных счетов
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-1"
          >
            <Filter className="w-4 h-4" />
            {showArchived ? 'Показать активные' : 'Показать архив'}
          </Button>
          <Button
            onClick={() => {
              setEditingAccount(null)
              setShowForm(true)
            }}
            className="flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Новый счет
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {showArchived ? (
          archivedAccounts.length > 0 ? (
            archivedAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onEdit={handleEdit}
                onArchive={archiveMutation.mutate}
                onUnarchive={unarchiveMutation.mutate}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-gray-400">
              <p className="text-lg">Нет архивированных счетов</p>
            </div>
          )
        ) : (
          activeAccounts.length > 0 ? (
            activeAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onEdit={handleEdit}
                onArchive={archiveMutation.mutate}
                onUnarchive={unarchiveMutation.mutate}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-400 text-lg">Нет активных счетов</p>
              <p className="text-gray-400 text-sm mt-1">
                Создайте первый счет, чтобы начать учет
              </p>
              <Button
                onClick={() => {
                  setEditingAccount(null)
                  setShowForm(true)
                }}
                className="mt-4"
              >
                Создать счет
              </Button>
            </div>
          )
        )}
      </div>

      <AccountForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false)
          setEditingAccount(null)
        }}
        onSuccess={handleFormSuccess}
        account={editingAccount || undefined}
      />
    </div>
  )
}

export default AccountsPage
