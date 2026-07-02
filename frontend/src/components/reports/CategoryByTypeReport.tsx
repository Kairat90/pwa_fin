import React, { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabaseApi } from '../../api/supabase'
import { Account } from '../../types'
import { buildCategoryBreakdown } from '../../utils/categoryBreakdownReport'
import { DEFAULT_CURRENCY, formatCurrency, normalizeCurrency } from '../../utils/currency'
import { formatReportDateRange, getReportDateRange } from '../../utils/reportPeriod'
import { Card } from '../ui/Card'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { CategoryHorizontalBars } from './CategoryHorizontalBars'
import { ReportCustomDateRangeRow } from './ReportCustomDateRangeRow'
import {
  formatReportPeriodHint,
  ReportFiltersBar,
  ReportFiltersState
} from './ReportFiltersBar'

interface CategoryByTypeReportProps {
  type: 'income' | 'expense'
}

/** Начальные фильтры: текущий месяц, счета в тенге */
export function getDefaultReportFilters(accounts: Account[]): ReportFiltersState {
  const active = accounts.filter((account) => !account.isArchived)
  const kztIds = active
    .filter((account) => normalizeCurrency(account.currency) === DEFAULT_CURRENCY)
    .map((account) => account.id)

  const today = format(new Date(), 'yyyy-MM-dd')

  return {
    period: 'month',
    customStart: today,
    customEnd: today,
    accountIds: kztIds.length > 0 ? kztIds : active.map((account) => account.id)
  }
}

/** Отчёт по категориям с фильтрами и горизонтальной диаграммой */
export const CategoryByTypeReport: React.FC<CategoryByTypeReportProps> = ({ type }) => {
  const [filters, setFilters] = useState<ReportFiltersState | null>(null)
  const [defaultsApplied, setDefaultsApplied] = useState(false)

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => supabaseApi.accounts.getAll()
  })

  useEffect(() => {
    if (accounts.length > 0 && !defaultsApplied) {
      setFilters(getDefaultReportFilters(accounts))
      setDefaultsApplied(true)
    }
  }, [accounts, defaultsApplied])

  const dateRange = useMemo(() => {
    if (!filters) {
      return getReportDateRange('month')
    }

    return getReportDateRange(
      filters.period,
      filters.customStart ? new Date(filters.customStart) : undefined,
      filters.customEnd ? new Date(filters.customEnd) : undefined
    )
  }, [filters])

  const { dateFrom, dateTo } = formatReportDateRange(dateRange)

  const canFetch = Boolean(filters && filters.accountIds.length > 0)

  const { data: transactions = [], isLoading: transactionsLoading, isFetching } = useQuery({
    queryKey: ['reportTransactions', dateFrom, dateTo, filters?.accountIds],
    queryFn: () => supabaseApi.transactions.getAllInRange(dateFrom, dateTo, filters!.accountIds),
    enabled: canFetch
  })

  const breakdown = useMemo(
    () => buildCategoryBreakdown(transactions, type),
    [transactions, type]
  )

  const total = useMemo(
    () => breakdown.reduce((sum, item) => sum + item.amount, 0),
    [breakdown]
  )

  const handleReset = () => {
    setFilters(getDefaultReportFilters(accounts))
  }

  const title = type === 'income' ? 'Доходы по категориям' : 'Расходы по категориям'
  const periodHint = filters
    ? formatReportPeriodHint(filters.period, filters.customStart, filters.customEnd)
    : ''

  if (accountsLoading || !filters) {
    return (
      <div className="flex items-center justify-center h-48">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {periodHint} · {DEFAULT_CURRENCY}
            {isFetching && !transactionsLoading && (
              <span className="ml-2 text-primary-500">обновление…</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">Итого</p>
          <p className={`text-xl font-bold tabular-nums ${type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(total, DEFAULT_CURRENCY)}
          </p>
        </div>
      </div>

      <div className="mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
        <ReportFiltersBar
          filters={filters}
          accounts={accounts}
          onChange={setFilters}
          onReset={handleReset}
          currencyLabel={DEFAULT_CURRENCY}
        />
      </div>

      {filters.period === 'custom' && (
        <ReportCustomDateRangeRow
          className="md:hidden mb-6"
          customStart={filters.customStart}
          customEnd={filters.customEnd}
          onChange={(customStart, customEnd) => setFilters({ ...filters, customStart, customEnd })}
        />
      )}

      {transactionsLoading ? (
        <div className="flex items-center justify-center h-40">
          <LoadingSpinner />
        </div>
      ) : (
        <CategoryHorizontalBars
          data={breakdown}
          type={type}
          currency={DEFAULT_CURRENCY}
        />
      )}
    </Card>
  )
}
