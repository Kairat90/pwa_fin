import React from 'react'
import { Edit2, Trash2, Star, Phone, Mail, User } from 'lucide-react'
import { Contact, Debt } from '../../types'
import { formatCurrency } from '../../utils/currency'
import { cn } from '../../utils/cn'

interface ContactCardProps {
  contact: Contact
  onEdit: (contact: Contact) => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string, isFavorite: boolean) => void
}

function debtRemaining(debt: Debt): number {
  return debt.remainingAmount ?? Number(debt.amount)
}

export const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onEdit,
  onDelete,
  onToggleFavorite
}) => {
  const activeDebts = contact.debts?.filter(
    (d) => d.status === 'active' || d.status === 'overdue'
  ) || []
  const totalDebt = activeDebts.reduce((sum, d) => sum + debtRemaining(d), 0)
  const hasActiveDebts = activeDebts.length > 0
  const settledCount = contact.debts?.filter((d) => d.status === 'settled').length || 0

  return (
    <div className="bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-xl text-primary-600 flex-shrink-0">
            {contact.avatarData ? (
              <img src={contact.avatarData} alt={contact.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-6 h-6" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900">{contact.name}</h3>
              {contact.isFavorite && (
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
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
                    <Phone className="w-3 h-3" />
                    {contact.phone}
                  </span>
                )}
                {contact.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {contact.email}
                  </span>
                )}
              </div>
            )}
            {contact.note && (
              <p className="text-sm text-gray-400 mt-1 truncate">{contact.note}</p>
            )}
          </div>
        </div>
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
            <Star className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onEdit(contact)}
            className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(contact.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {contact.debts && contact.debts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Активных долгов: {activeDebts.length}</span>
            <span className="text-gray-500">Погашено: {settledCount}</span>
          </div>
        </div>
      )}
    </div>
  )
}
