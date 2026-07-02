import React from 'react'
import { format } from 'date-fns'
import { RotateCcw } from 'lucide-react'
import { Account } from '../../types'
import { cn } from '../../utils/cn'
import { normalizeCurrency } from '../../utils/currency'
import {
  REPORT_PERIOD_LABELS,
  ReportPeriodPreset
} from '../../utils/reportPeriod'
import { Button } from '../ui/Button'

export type ReportFiltersState = {
  period: ReportPeriodPreset
  customStart: string
  customEnd: string
  accountIds: string[]
}

interface ReportFiltersBarProps {
  filters: ReportFiltersState
  accounts: Account[]
  onChange: (filters: ReportFiltersState) => void
  onReset: () => void
  currencyLabel?: string
}

const PERIOD_OPTIONS: ReportPeriodPreset[] = ['day', 'week', 'month', 'year', 'custom']

/** Фильтры отчёта: период, счета, сброс */
export const ReportFiltersBar: React.FC<ReportFiltersBarProps> = ({
  filters,
  accounts,
  onChange,
  onReset,
  currencyLabel = 'KZT'
}) => {
  const activeAccounts = accounts.filter((a) => !a.isArchived)

  const toggleAccount = (accountId: string) => {
    const set = new Set(filters.accountIds)
    if (set.has(accountId)) {
      set.delete(accountId)
    } else {
      set.add(accountId)
    }

    onChange({ ...filters, accountIds: Array.from(set) })
  }

  const selectAllKzt = () => {
    const kztIds = activeAccounts
      .filter((a) => normalizeCurrency(a.currency) === currencyLabel)
      .map((a) => a.id)

    onChange({
      ...filters,
      accountIds: kztIds.length > 0 ? kztIds : activeAccounts.map((a) => a.id)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">Период:</span>
        {PERIOD_OPTIONS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange({ ...filters, period: preset })}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg border transition-colors',
              filters.period === preset
                ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            )}
          >
            {REPORT_PERIOD_LABELS[preset]}
          </button>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={onReset} className="ml-auto gap-1">
          <RotateCcw className="w-4 h-4" />
          Сбросить
        </Button>
      </div>

      {filters.period === 'custom' && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">С</label>
            <input
              type="date"
              value={filters.customStart}
              onChange={(e) => onChange({ ...filters, customStart: e.target.value })}
              className="rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">По</label>
            <input
              type="date"
              value={filters.customEnd}
              onChange={(e) => onChange({ ...filters, customEnd: e.target.value })}
              className="rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Счета ({currencyLabel}):
          </span>
          <button
            type="button"
            onClick={selectAllKzt}
            className="text-xs text-primary-600 hover:underline dark:text-primary-400"
          >
            Все {currencyLabel}
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filters, accountIds: activeAccounts.map((a) => a.id) })}
            className="text-xs text-gray-500 hover:underline"
          >
            Все счета
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeAccounts.map((account) => {
            const selected = filters.accountIds.includes(account.id)

            return (
              <button
                key={account.id}
                type="button"
                onClick={() => toggleAccount(account.id)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                  selected
                    ? 'border-primary-500 bg-primary-50 text-primary-800 dark:bg-primary-900/30 dark:text-primary-200'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 opacity-60'
                )}
              >
                {account.icon ? `${account.icon} ` : ''}{account.name}
                <span className="text-xs ml-1 opacity-70">({normalizeCurrency(account.currency)})</span>
              </button>
            )
          })}
        </div>
        {filters.accountIds.length === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            Выберите хотя бы один счёт
          </p>
        )}
      </div>
    </div>
  )
}

export function formatReportPeriodHint(
  period: ReportPeriodPreset,
  customStart: string,
  customEnd: string
): string {
  if (period === 'custom' && customStart) {
    const end = customEnd || customStart
    return `${format(new Date(customStart), 'dd.MM.yyyy')} — ${format(new Date(end), 'dd.MM.yyyy')}`
  }

  return REPORT_PERIOD_LABELS[period].toLowerCase()
}
