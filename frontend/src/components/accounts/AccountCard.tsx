import React from 'react'
import { Archive, Edit2, RotateCcw, Star } from 'lucide-react'
import { Account } from '../../types'
import { formatCurrency } from '../../utils/currency'
import { cn } from '../../utils/cn'
import { getAccountDisplayColor, getAccountDisplayIcon } from '../../utils/accountIcons'
import { EMOJI_BOX_16, ICON_16 } from '../../utils/iconSize'

interface AccountCardProps {
  account: Account
  isDefault?: boolean
  onEdit: (account: Account) => void
  onArchive: (id: string) => void
  onUnarchive: (id: string) => void
  onSetDefault?: (id: string) => void
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  investment: 'Инвестиции',
  savings: 'Накопления'
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  isDefault = false,
  onEdit,
  onArchive,
  onUnarchive,
  onSetDefault
}) => {
  const balance = Number(account.balance ?? account.initialBalance)
  const initialBalance = Number(account.initialBalance)

  return (
    <div className={cn(
      'bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow',
      account.isArchived && 'opacity-60',
      isDefault && !account.isArchived && 'border-primary-300 ring-1 ring-primary-100'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={EMOJI_BOX_16}
            style={{ backgroundColor: getAccountDisplayColor(account) }}
          >
            {getAccountDisplayIcon(account)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 truncate">{account.name}</h3>
              {isDefault && !account.isArchived && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">
                  <Star className="w-3 h-3 fill-primary-500 text-primary-500" />
                  По умолчанию
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {ACCOUNT_TYPE_LABELS[account.type || ''] || 'Счет'}
              {account.isArchived && ' (Архивирован)'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!account.isArchived && (
            <>
              {!isDefault && onSetDefault && (
                <button
                  type="button"
                  onClick={() => onSetDefault(account.id)}
                  className="p-1.5 text-gray-400 hover:text-amber-500 rounded-lg hover:bg-amber-50 transition-colors"
                  title="Сделать основным"
                >
                  <Star className={ICON_16} />
                </button>
              )}
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
