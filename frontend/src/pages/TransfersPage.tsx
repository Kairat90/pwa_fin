import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Plus, ArrowRight, Trash2 } from 'lucide-react'
import { supabaseApi, getErrorMessage } from '../api/supabase'
import { TransferForm } from '../components/transfers/TransferForm'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { formatCurrency } from '../utils/currency'
import { cn } from '../utils/cn'
import { ICON_16 } from '../utils/iconSize'

const TransfersPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false)
  const queryClient = useQueryClient()

  const { data: transfersData, isLoading } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => supabaseApi.transfers.getAll()
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => supabaseApi.transfers.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('Перевод отменен')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Ошибка отмены перевода')
    }
  })

  const transfers = transfersData?.data || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Переводы</h1>
          <p className="text-gray-500 text-sm">
            {transfers.length} переводов
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-1" />
          Новый перевод
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : transfers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">Нет переводов</p>
          <p className="text-sm mt-1">Создайте первый перевод</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transfers.map((transfer) => (
            <div
              key={transfer.id}
              className="bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{transfer.fromAccount?.icon || '🏦'}</span>
                    <span className="font-medium">{transfer.fromAccount?.name || 'Удален'}</span>
                  </div>
                  <ArrowRight className={cn(ICON_16, 'text-gray-400 flex-shrink-0')} />
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{transfer.toAccount?.icon || '🏦'}</span>
                    <span className="font-medium">{transfer.toAccount?.name || 'Удален'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      {formatCurrency(Number(transfer.amount), transfer.fromAccount?.currency)}
                    </p>
                    {Number(transfer.fee) > 0 && (
                      <p className="text-xs text-gray-400">
                        Комиссия: {formatCurrency(Number(transfer.fee), transfer.fromAccount?.currency)}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {format(new Date(transfer.date), 'dd MMM yyyy, HH:mm', { locale: ru })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(transfer.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    title="Отменить перевод"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {transfer.note && (
                <p className="text-sm text-gray-500 mt-2">{transfer.note}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <TransferForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['transfers'] })
          queryClient.invalidateQueries({ queryKey: ['accounts'] })
          setShowForm(false)
        }}
      />
    </div>
  )
}

export default TransfersPage
