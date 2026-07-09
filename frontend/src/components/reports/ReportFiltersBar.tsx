import React, { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Calendar, ChevronDown, RotateCcw, Wallet } from 'lucide-react'
import { Account } from '../../types'
import { cn } from '../../utils/cn'
import { normalizeCurrency } from '../../utils/currency'
import {
  getCustomPeriodDates,
  REPORT_PERIOD_LABELS,
  ReportPeriodPreset
} from '../../utils/reportPeriod'
import { Button } from '../ui/Button'
import { ReportAccountsModal } from './ReportAccountsModal'

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

type OpenDropdown = 'period' | null

interface FilterDropdownProps {
  icon: React.ReactNode
  label: string
  value: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  className?: string
}

/** Кнопка-фильтр с выпадающей панелью (мобильная версия) */
const FilterDropdown: React.FC<FilterDropdownProps> = ({
  icon,
  label,
  value,
  isOpen,
  onToggle,
  children,
  className
}) => {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        onToggle()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isOpen, onToggle])

  return (
    <div ref={panelRef} className={cn('relative flex-1 min-w-0', className)}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors',
          isOpen
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
        )}
      >
        <span className="text-gray-500 dark:text-gray-400 shrink-0">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 leading-none mb-0.5">
            {label}
          </span>
          <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {value}
          </span>
        </span>
        <ChevronDown className={cn('w-4 h-4 shrink-0 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-3 max-h-[min(70vh,320px)] overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  )
}

function getAccountsSummary(accountIds: string[], activeAccounts: Account[]): string {
  if (accountIds.length === 0) {
    return 'Не выбраны'
  }

  if (accountIds.length === activeAccounts.length) {
    return 'Все счета'
  }

  if (accountIds.length === 1) {
    const account = activeAccounts.find((item) => item.id === accountIds[0])
    return account ? account.name : '1 счёт'
  }

  return `${accountIds.length} счёта`
}

function getPeriodSummary(
  period: ReportPeriodPreset,
  customStart: string,
  customEnd: string
): string {
  if (period === 'custom' && customStart) {
    const end = customEnd || customStart
    return `${format(new Date(customStart), 'dd.MM.yy')} — ${format(new Date(end), 'dd.MM.yy')}`
  }

  return REPORT_PERIOD_LABELS[period]
}

/** Фильтры отчёта: период, счета, сброс */
export const ReportFiltersBar: React.FC<ReportFiltersBarProps> = ({
  filters,
  accounts,
  onChange,
  onReset,
  currencyLabel = 'KZT'
}) => {
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null)
  const [accountsModalOpen, setAccountsModalOpen] = useState(false)
  const activeAccounts = accounts.filter((account) => !account.isArchived)

  const toggleDropdown = (id: OpenDropdown) => {
    setOpenDropdown((current) => (current === id ? null : id))
  }

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
      .filter((account) => normalizeCurrency(account.currency) === currencyLabel)
      .map((account) => account.id)

    onChange({
      ...filters,
      accountIds: kztIds.length > 0 ? kztIds : activeAccounts.map((account) => account.id)
    })
  }

  const applyPreset = (preset: ReportPeriodPreset) => {
    if (preset === 'custom') {
      onChange({
        ...filters,
        period: 'custom',
        ...getCustomPeriodDates(filters)
      })
    } else {
      onChange({ ...filters, period: preset })
    }

    setOpenDropdown(null)
  }

  const periodOptions = (
    <div className="space-y-1">
      {PERIOD_OPTIONS.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => applyPreset(preset)}
          className={cn(
            'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
            filters.period === preset
              ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200 font-medium'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          )}
        >
          {REPORT_PERIOD_LABELS[preset]}
        </button>
      ))}
    </div>
  )

  const accountsSummary = getAccountsSummary(filters.accountIds, activeAccounts)

  return (
    <div className="space-y-4">
      {/* Мобильная версия — период выпадающий, счёт в модалке */}
      <div className="md:hidden space-y-2">
        <div className="flex gap-2">
          <FilterDropdown
            icon={<Calendar className="w-4 h-4" />}
            label="Период"
            value={getPeriodSummary(filters.period, filters.customStart, filters.customEnd)}
            isOpen={openDropdown === 'period'}
            onToggle={() => toggleDropdown('period')}
          >
            {periodOptions}
          </FilterDropdown>

          <button
            type="button"
            onClick={() => setAccountsModalOpen(true)}
            className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
          >
            <span className="text-gray-500 dark:text-gray-400 shrink-0">
              <Wallet className="w-4 h-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 leading-none mb-0.5">
                Счёт
              </span>
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {accountsSummary}
              </span>
            </span>
          </button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
            className="shrink-0 px-3"
            aria-label="Сбросить фильтры"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        <ReportAccountsModal
          isOpen={accountsModalOpen}
          onClose={() => setAccountsModalOpen(false)}
          accounts={accounts}
          selectedIds={filters.accountIds}
          currencyLabel={currencyLabel}
          onApply={(accountIds) => onChange({ ...filters, accountIds })}
        />
      </div>

      {/* Десктоп — кнопки в ряд */}
      <div className="hidden md:block space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">Период:</span>
          {PERIOD_OPTIONS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => applyPreset(preset)}
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
              onClick={() => onChange({ ...filters, accountIds: activeAccounts.map((account) => account.id) })}
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
                  {account.name}
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
