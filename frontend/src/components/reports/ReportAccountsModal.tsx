import React, { useEffect, useState } from 'react'
import { Account } from '../../types'
import { cn } from '../../utils/cn'
import { normalizeCurrency } from '../../utils/currency'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface ReportAccountsModalProps {
  isOpen: boolean
  onClose: () => void
  accounts: Account[]
  selectedIds: string[]
  currencyLabel: string
  onApply: (accountIds: string[]) => void
}

/** Модальное окно выбора счетов для фильтра отчёта (мобильная версия) */
export const ReportAccountsModal: React.FC<ReportAccountsModalProps> = ({
  isOpen,
  onClose,
  accounts,
  selectedIds,
  currencyLabel,
  onApply
}) => {
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds)
  const activeAccounts = accounts.filter((account) => !account.isArchived)

  useEffect(() => {
    if (isOpen) {
      setDraftIds(selectedIds)
    }
  }, [isOpen, selectedIds])

  const toggleAccount = (accountId: string) => {
    setDraftIds((current) => {
      const set = new Set(current)

      if (set.has(accountId)) {
        set.delete(accountId)
      } else {
        set.add(accountId)
      }

      return Array.from(set)
    })
  }

  const selectAllKzt = () => {
    const kztIds = activeAccounts
      .filter((account) => normalizeCurrency(account.currency) === currencyLabel)
      .map((account) => account.id)

    setDraftIds(kztIds.length > 0 ? kztIds : activeAccounts.map((account) => account.id))
  }

  const selectAll = () => {
    setDraftIds(activeAccounts.map((account) => account.id))
  }

  const handleApply = () => {
    if (draftIds.length === 0) {
      return
    }

    onApply(draftIds)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Выбор счёта" size="md" tallMobile>
      <div className="flex flex-col gap-4 min-h-[min(72dvh,36rem)]">
        <div className="flex flex-wrap gap-3 pb-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <button
            type="button"
            onClick={selectAllKzt}
            className="text-sm text-primary-600 hover:underline dark:text-primary-400"
          >
            Все {currencyLabel}
          </button>
          <button
            type="button"
            onClick={selectAll}
            className="text-sm text-gray-600 hover:underline dark:text-gray-400"
          >
            Все счета
          </button>
        </div>

        <div className="flex-1 min-h-[min(52dvh,28rem)] overflow-y-auto overscroll-contain py-2 px-0.5 space-y-2">
          {activeAccounts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
              Нет активных счетов
            </p>
          ) : (
            activeAccounts.map((account) => {
              const selected = draftIds.includes(account.id)

              return (
                <label
                  key={account.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors',
                    selected
                      ? 'bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-200 dark:ring-primary-800'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleAccount(account.id)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 shrink-0"
                  />
                  <span className="text-xl shrink-0" aria-hidden>{account.icon || '💰'}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {account.name}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {normalizeCurrency(account.currency)}
                    </span>
                  </span>
                </label>
              )
            })
          )}
        </div>

        {draftIds.length === 0 && (
          <p className="text-sm text-amber-600 dark:text-amber-400 shrink-0">
            Выберите хотя бы один счёт
          </p>
        )}

        <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={draftIds.length === 0}
            onClick={handleApply}
          >
            Применить
          </Button>
        </div>
      </div>
    </Modal>
  )
}
