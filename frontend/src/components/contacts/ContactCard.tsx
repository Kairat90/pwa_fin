import React from 'react'
import { Edit2, Trash2, Star, Phone, Mail, User, ChevronRight } from 'lucide-react'
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

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onViewHistory(contact)}
          className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-lg -m-1 p-1 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <div className={cn(EMOJI_BOX_16, 'rounded-full bg-primary-100 text-primary-600 overflow-hidden shrink-0')}>
            {contact.avatarData ? (
              <img src={contact.avatarData} alt={contact.name} className="w-full h-full object-cover" />
            ) : (
              <User className={ICON_16} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{contact.name}</h3>
              {contact.isFavorite && (
                <Star className={cn(ICON_16, 'text-yellow-400 fill-yellow-400')} />
              )}
              {hasActiveDebts && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                  {formatCurrency(totalDebt)}
                </span>
              )}
            </div>
            {(contact.phone || contact.email) && (
              <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5 flex-wrap">
                {contact.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className={ICON_16} />
                    {contact.phone}
                  </span>
                )}
                {contact.email && (
                  <span className="flex items-center gap-1">
                    <Mail className={ICON_16} />
                    {contact.email}
                  </span>
                )}
              </div>
            )}
            {contact.note && (
              <p className="text-sm text-gray-400 mt-1 truncate">{contact.note}</p>
            )}
          </div>
          <ChevronRight className={cn(ICON_16, 'text-gray-300 shrink-0 self-center')} />
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onToggleFavorite(contact.id, !contact.isFavorite)}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              contact.isFavorite
                ? 'text-yellow-400 hover:text-yellow-500'
                : 'text-gray-300 hover:text-yellow-400'
            )}
            title="Избранное"
          >
            <Star className={ICON_16} />
          </button>
          <button
            type="button"
            onClick={() => onEdit(contact)}
            className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
          >
            <Edit2 className={ICON_16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(contact.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className={ICON_16} />
          </button>
        </div>
      </div>

      {contact.debts && contact.debts.length > 0 && (
        <button
          type="button"
          onClick={() => onViewHistory(contact)}
          className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 w-full text-left hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Активных долгов: {activeDebts.length}</span>
            <span className="text-primary-600 dark:text-primary-400 text-xs">История →</span>
          </div>
        </button>
      )}
    </div>
  )
}
