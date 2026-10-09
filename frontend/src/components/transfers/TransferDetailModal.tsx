import React from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ArrowDown, Pencil, Trash2 } from 'lucide-react'
import { Transfer } from '../../types'
import { formatCurrency } from '../../utils/currency'
import { ICON_16 } from '../../utils/iconSize'
import { AccountIcon } from '../accounts/AccountIcon'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface TransferDetailModalProps {
  isOpen: boolean
  onClose: () => void
  transfer: Transfer | null
  onEdit: (transfer: Transfer) => void
  onDelete: (transfer: Transfer) => void
  deleting?: boolean
}

/** Просмотр перевода между счетами */
export const TransferDetailModal: React.FC<TransferDetailModalProps> = ({
  isOpen,
  onClose,
  transfer,
  onEdit,
  onDelete,
  deleting = false
}) => {
  if (!transfer) {
    return null
  }

  const currency = transfer.fromAccount?.currency
  const amount = Number(transfer.amount)
  const fee = Number(transfer.fee) || 0

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Перевод" size="md">
      <div className="space-y-5">
        <div className="text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(amount, currency)}</p>
          {fee > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              Комиссия {formatCurrency(fee, currency)} · всего списано {formatCurrency(amount + fee, currency)}
            </p>
          )}
          <p className="text-sm text-gray-500 mt-1">
            {format(new Date(transfer.date), 'dd MMMM yyyy', { locale: ru })}
          </p>
        </div>

        <div className="rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          <div className="flex items-center gap-3 p-3">
            <AccountIcon
              icon={transfer.fromAccount?.icon}
              color={transfer.fromAccount?.color}
              type={transfer.fromAccount?.type}
              size="sm"
            />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Со счёта</p>
              <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                {transfer.fromAccount?.name || 'Удалён'}
              </p>
            </div>
          </div>
          <div className="flex justify-center py-1 text-gray-400">
            <ArrowDown className={ICON_16} />
          </div>
          <div className="flex items-center gap-3 p-3">
            <AccountIcon
              icon={transfer.toAccount?.icon}
              color={transfer.toAccount?.color}
              type={transfer.toAccount?.type}
              size="sm"
            />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">На счёт</p>
              <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                {transfer.toAccount?.name || 'Удалён'}
              </p>
            </div>
          </div>
        </div>

        {transfer.note && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Примечание</p>
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{transfer.note}</p>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Button
            type="button"
            variant="secondary"
            className="flex-1 inline-flex items-center justify-center gap-1"
            onClick={() => onEdit(transfer)}
          >
            <Pencil className={ICON_16} />
            Редактировать
          </Button>
          <Button
            type="button"
            loading={deleting}
            className="flex-1 inline-flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700"
            onClick={() => onDelete(transfer)}
          >
            <Trash2 className={ICON_16} />
            Удалить
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default TransferDetailModal
