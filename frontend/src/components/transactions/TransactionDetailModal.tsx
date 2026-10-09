import React from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Transaction } from '../../types'
import { formatCurrency } from '../../utils/currency'
import { cn } from '../../utils/cn'
import { ICON_16 } from '../../utils/iconSize'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface TransactionDetailModalProps {
  isOpen: boolean
  onClose: () => void
  transaction: Transaction | null
  onEdit: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
  onRepeat?: (transaction: Transaction) => void
}

/** Строка «подпись — значение» в окне просмотра */
const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-2.5">
    <span className="text-sm text-gray-500 shrink-0">{label}</span>
    <span className="text-sm text-gray-900 dark:text-gray-100 text-right min-w-0 break-words">{children}</span>
  </div>
)

/** Просмотр транзакции */
export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onEdit,
  onDelete,
  onRepeat
}) => {
  const navigate = useNavigate()

  if (!transaction) {
    return null
  }

  const amount = Number(transaction.amount)
  const isIncome = amount > 0
  const isTransfer = transaction.tags.includes('transfer')
  const visibleTags = transaction.tags.filter((tag) => tag !== 'transfer' && !tag.startsWith('tid:'))

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isTransfer ? 'Перевод' : isIncome ? 'Доход' : 'Расход'} size="md">
      <div className="space-y-5">
        <div className="text-center">
          <p className={cn('text-3xl font-bold', isIncome ? 'text-green-600' : 'text-red-600')}>
            {isIncome ? '+' : ''}
            {formatCurrency(amount, transaction.account?.currency)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {format(new Date(transaction.date), 'dd MMMM yyyy', { locale: ru })}
          </p>
        </div>

        <div className="rounded-xl border border-gray-100 dark:border-gray-800 px-3 divide-y divide-gray-100 dark:divide-gray-800">
          <DetailRow label="Категория">{transaction.category?.name || 'Без категории'}</DetailRow>
          <DetailRow label="Счёт">{transaction.account?.name || 'Счёт удалён'}</DetailRow>
          {transaction.note && <DetailRow label="Примечание">{transaction.note}</DetailRow>}
          {visibleTags.length > 0 && (
            <DetailRow label="Теги">
              <span className="inline-flex flex-wrap justify-end gap-1">
                {visibleTags.map((tag) => (
                  <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
              </span>
            </DetailRow>
          )}
          {transaction.isScheduled && <DetailRow label="Источник">Планировщик</DetailRow>}
          {transaction.isExcludedFromBudget && !isTransfer && <DetailRow label="Бюджет">Не учитывается</DetailRow>}
        </div>

        {isTransfer ? (
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
            <p className="text-sm text-gray-500">
              Это часть перевода между счетами — изменить или отменить его можно в разделе «Переводы».
            </p>
            <Button type="button" variant="secondary" className="w-full" onClick={() => navigate('/transfers')}>
              Открыть переводы
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              variant="secondary"
              className="flex-1 inline-flex items-center justify-center gap-1"
              onClick={() => onEdit(transaction)}
            >
              <Pencil className={ICON_16} />
              Редактировать
            </Button>
            {onRepeat && (
              <Button
                type="button"
                variant="secondary"
                className="flex-1 inline-flex items-center justify-center gap-1"
                onClick={() => onRepeat(transaction)}
              >
                <RotateCcw className={ICON_16} />
                Повторить
              </Button>
            )}
            <Button
              type="button"
              className="flex-1 inline-flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700"
              onClick={() => onDelete(transaction)}
            >
              <Trash2 className={ICON_16} />
              Удалить
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default TransactionDetailModal
