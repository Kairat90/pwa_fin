import React from 'react'
import { Edit2, Archive, RotateCcw } from 'lucide-react'
import { Account } from '../../types'
import { formatCurrency } from '../../utils/currency'
import { EMOJI_BOX_16, ICON_16 } from '../../utils/iconSize'

interface AccountCardProps {
  account: Account
  onEdit: (account: Account) => void
  onArchive: (id: string) => void
  onUnarchive: (id: string) => void
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  investment: 'Инвестиции',
  savings: 'Накопления'
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  onEdit,
  onArchive,
  onUnarchive
}) => {
  const balance = Number(account.balance ?? account.initialBalance)
  const initialBalance = Number(account.initialBalance)

  return (
    <div className={cn(
      'bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow',
      account.isArchived && 'opacity-60'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={EMOJI_BOX_16}
            style={{ backgroundColor: account.color || '#4F46E5' }}
          >
            {account.icon || '💰'}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{account.name}</h3>
            <p className="text-sm text-gray-500">
              {ACCOUNT_TYPE_LABELS[account.type || ''] || 'Счет'}
              {account.isArchived && ' (Архивирован)'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!account.isArchived && (
            <>
              <button
                type="button"
                onClick={() => onEdit(account)}
                className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                title="Редактировать"
              >
                <Edit2 className={ICON_16} />
              </button>
              <button
                type="button"
                onClick={() => onArchive(account.id)}
                className="p-1.5 text-gray-400 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition-colors"
                title="Архивировать"
              >
                <Archive className={ICON_16} />
              </button>
            </>
          )}
          {account.isArchived && (
            <button
              type="button"
              onClick={() => onUnarchive(account.id)}
              className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition-colors"
              title="Восстановить"
            >
              <RotateCcw className={ICON_16} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Баланс</span>
          <span className={cn(
            'text-lg font-bold',
            balance >= 0 ? 'text-green-600' : 'text-red-600'
          )}>
            {formatCurrency(balance, account.currency)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-sm text-gray-500">Начальный баланс</span>
          <span className="text-sm text-gray-600">
            {formatCurrency(initialBalance, account.currency)}
          </span>
        </div>
      </div>
    </div>
  )
}
