import React from 'react'
import { Edit2, Trash2, Star, User } from 'lucide-react'
import { Contact, Debt } from '../../types'
import { formatCurrency } from '../../utils/currency'
import { cn } from '../../utils/cn'
import { EMOJI_BOX_16, ICON_16 } from '../../utils/iconSize'

interface ContactCardProps {
  contact: Contact
  onEdit: (contact: Contact) => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string, isFavorite: boolean) => void
  onViewHistory: (contact: Contact) => void
}

function debtRemaining(debt: Debt): number {
  return debt.remainingAmount ?? Number(debt.amount)
}

/** Компактная карточка контакта в общем списке */
export const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onEdit,
  onDelete,
  onToggleFavorite,
  onViewHistory
}) => {
  const activeDebts = contact.debts?.filter(
    (d) => d.status === 'active' || d.status === 'overdue'
  ) || []
  const totalDebt = activeDebts.reduce((sum, d) => sum + debtRemaining(d), 0)
  const hasActiveDebts = activeDebts.length > 0
  const contactLine = contact.phone || contact.email || ''

  return (
    <div
      className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 px-3 py-2.5 shadow-sm hover:shadow-md transition-all cursor-pointer"
      onClick={() => onViewHistory(contact)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onViewHistory(contact)}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div className={cn(EMOJI_BOX_16, 'rounded-full bg-primary-100 text-primary-600 overflow-hidden shrink-0')}>
          {contact.avatarData ? (
            <img src={contact.avatarData} alt={contact.name} className="w-full h-full object-cover" />
          ) : (
            <User className={ICON_16} />
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {contact.name}
            </h3>
            {contact.isFavorite && (
              <Star className={cn(ICON_16, 'text-yellow-400 fill-yellow-400 shrink-0')} />
            )}
          </div>

          {contactLine && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate sm:max-w-[180px]">
              {contactLine}
            </p>
          )}
        </div>

        {hasActiveDebts && (
          <span className="text-xs font-semibold text-red-600 dark:text-red-400 shrink-0 tabular-nums whitespace-nowrap">
            {formatCurrency(totalDebt)}
          </span>
        )}

        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onToggleFavorite(contact.id, !contact.isFavorite)}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              contact.isFavorite
                ? 'text-yellow-400 hover:text-yellow-500'
                : 'text-gray-300 hover:text-yellow-400 dark:text-gray-600'
            )}
            title={contact.isFavorite ? 'Убрать из избранного' : 'В избранное'}
          >
            <Star className={ICON_16} />
          </button>
          <button
            type="button"
            onClick={() => onEdit(contact)}
            className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
            title="Редактировать"
          >
            <Edit2 className={ICON_16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(contact.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            title="Удалить"
          >
            <Trash2 className={ICON_16} />
          </button>
        </div>
      </div>
    </div>
  )
}
