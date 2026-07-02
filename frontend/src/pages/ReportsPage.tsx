import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  FileSpreadsheet,
  FileText,
  Save,
  Upload,
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  RefreshCw
} from 'lucide-react'
import { supabaseApi, getErrorMessage } from '../api/supabase'
import { DateRangePicker } from '../components/reports/DateRangePicker'
import { ReportCard } from '../components/reports/ReportCard'
import { CategoryChart } from '../components/reports/CategoryChart'
import { ComparisonChart } from '../components/reports/ComparisonChart'
import { ForecastCard } from '../components/reports/ForecastCard'
import { ReportTypeList, ReportTypeId } from '../components/reports/ReportTypeList'
import { CategoryByTypeReport } from '../components/reports/CategoryByTypeReport'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { cn } from '../utils/cn'
import { MAX_BACKUP_FILE_BYTES } from '../utils/restoreBackup'
import { createAndExportBackup } from '../utils/backupExport'
import { formatLastBackupLabel } from '../utils/backupSchedule'

const ReportsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [activeReport, setActiveReport] = useState<ReportTypeId>('expense-categories')
  const [startDate, setStartDate] = useState(startOfMonth(new Date()))
  const [endDate, setEndDate] = useState(endOfMonth(new Date()))
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)

  const isOverview = activeReport === 'overview'
  const dateFrom = format(startDate, 'yyyy-MM-dd')
  const dateTo = format(endDate, 'yyyy-MM-dd')

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['reportSummary', dateFrom, dateTo],
    queryFn: () => supabaseApi.reports.getSummary(dateFrom, dateTo),
    enabled: isOverview
  })

  const { data: expenseCategories } = useQuery({
    queryKey: ['reportExpenseCategories', dateFrom, dateTo],
    queryFn: () => supabaseApi.reports.getCategoryBreakdown(dateFrom, dateTo, 'expense'),
    enabled: isOverview
  })

  const { data: incomeCategories } = useQuery({
    queryKey: ['reportIncomeCategories', dateFrom, dateTo],
    queryFn: () => supabaseApi.reports.getCategoryBreakdown(dateFrom, dateTo, 'income'),
    enabled: isOverview
  })

  const { data: comparison } = useQuery({
    queryKey: ['reportComparison', dateFrom, dateTo],
    queryFn: () => supabaseApi.reports.getComparison(dateFrom, dateTo),
    enabled: isOverview
  })

  const { data: forecast } = useQuery({
    queryKey: ['reportForecast'],
    queryFn: () => supabaseApi.reports.getForecast(30),
    enabled: isOverview
  })

  const { data: topTransactions } = useQuery({
    queryKey: ['reportTopTransactions', dateFrom, dateTo],
    queryFn: () => supabaseApi.reports.getTopTransactions(dateFrom, dateTo, 10),
    enabled: isOverview
  })

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['reportSummary'] })
    queryClient.invalidateQueries({ queryKey: ['reportExpenseCategories'] })
    queryClient.invalidateQueries({ queryKey: ['reportIncomeCategories'] })
    queryClient.invalidateQueries({ queryKey: ['reportComparison'] })
    queryClient.invalidateQueries({ queryKey: ['reportTopTransactions'] })
    queryClient.invalidateQueries({ queryKey: ['reportForecast'] })
    queryClient.invalidateQueries({ queryKey: ['reportTransactions'] })
    toast.success('Данные обновлены')
  }

  const handleExportExcel = async () => {
    try {
      setExporting('excel')
      await supabaseApi.reports.exportExcel(dateFrom, dateTo)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setExporting(null)
    }
  }

  const handleExportPDF = async () => {
    try {
      setExporting('pdf')
      await supabaseApi.reports.exportPDF(dateFrom, dateTo)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setExporting(null)
    }
  }

  const handleBackup = async () => {
    try {
      setBackupLoading(true)
      const method = await createAndExportBackup()
      toast.success(
        method === 'share'
          ? 'Бэкап готов — выберите приложение для сохранения'
          : 'Бэкап сохранён в файл'
      )
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      toast.error(getErrorMessage(error) || 'Ошибка создания бэкапа')
    } finally {
      setBackupLoading(false)
    }
  }

  const handleRestore = () => {
    if (
      !window.confirm(
        'Все текущие данные (счета, категории, транзакции, долги и т.д.) будут удалены и заменены содержимым бэкапа. Продолжить?'
      )
    ) {
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      if (file.size > MAX_BACKUP_FILE_BYTES) {
        toast.error(`Файл слишком большой (максимум ${Math.round(MAX_BACKUP_FILE_BYTES / 1024 / 1024)} МБ)`)
        return
      }

      try {
        setRestoreLoading(true)
        const text = await file.text()
        const data = JSON.parse(text)
        await supabaseApi.reports.restoreBackup(data)
        toast.success('Бэкап восстановлен')
        queryClient.invalidateQueries()
        window.location.reload()
      } catch (error: unknown) {
        toast.error(getErrorMessage(error) || 'Ошибка восстановления бэкапа')
      } finally {
        setRestoreLoading(false)
      }
    }
    input.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Отчеты и аналитика</h1>
          <p className="text-gray-500 text-sm">
            Анализ ваших финансов
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOverview && (
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onRangeChange={(start, end) => {
                setStartDate(start)
                setEndDate(end)
              }}
            />
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ReportTypeList activeId={activeReport} onChange={setActiveReport} />

      {activeReport === 'income-categories' && <CategoryByTypeReport type="income" />}
      {activeReport === 'expense-categories' && <CategoryByTypeReport type="expense" />}

      {isOverview && summaryLoading && (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {isOverview && !summaryLoading && (
        <>
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ReportCard
                title="Доходы"
                value={summary.totalIncome}
                icon={<TrendingUp className="w-4 h-4" />}
                color="text-green-600"
                subtitle="KZT"
              />
              <ReportCard
                title="Расходы"
                value={summary.totalExpense}
                icon={<TrendingDown className="w-4 h-4" />}
                color="text-red-600"
                subtitle="KZT"
              />
              <ReportCard
                title="Чистый поток"
                value={summary.netFlow}
                icon={<Wallet className="w-4 h-4" />}
                color={summary.netFlow >= 0 ? 'text-blue-600' : 'text-red-600'}
                subtitle="KZT"
              />
              <ReportCard
                title="Норма сбережений"
                value={summary.savingsRate.toFixed(1)}
                icon={<BarChart3 className="w-4 h-4" />}
                color={summary.savingsRate > 0 ? 'text-green-600' : 'text-red-600'}
                subtitle="%"
              />
            </div>
          )}

          {comparison && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Сравнение с прошлым периодом</h3>
          <ComparisonChart data={comparison} />
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-500">Доходы</p>
              <p className={cn(
                'font-bold',
                comparison.changes.income >= 0 ? 'text-green-600' : 'text-red-600'
              )}>
                {comparison.changes.income >= 0 ? '+' : ''}{comparison.changes.income.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Расходы</p>
              <p className={cn(
                'font-bold',
                comparison.changes.expense <= 0 ? 'text-green-600' : 'text-red-600'
              )}>
                {comparison.changes.expense >= 0 ? '+' : ''}{comparison.changes.expense.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Кол-во транзакций</p>
              <p className={cn(
                'font-bold',
                comparison.changes.transactions >= 0 ? 'text-blue-600' : 'text-gray-600'
              )}>
                {comparison.changes.transactions >= 0 ? '+' : ''}{comparison.changes.transactions.toFixed(1)}%
              </p>
            </div>
          </div>
        </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Структура расходов</h3>
              {expenseCategories && <CategoryChart data={expenseCategories} type="expense" />}
            </Card>
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Структура доходов</h3>
              {incomeCategories && <CategoryChart data={incomeCategories} type="income" />}
            </Card>
          </div>

          {forecast && <ForecastCard forecast={forecast} />}

          {topTransactions && topTransactions.length > 0 && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Топ трат за период</h3>
              <div className="space-y-3">
                {topTransactions.map((t, i) => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-gray-300 w-6">
                        #{i + 1}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{t.category || 'Без категории'}</p>
                        <p className="text-sm text-gray-500">
                          {t.account || 'Счет удален'} • {format(new Date(t.date), 'dd MMM yyyy', { locale: ru })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">
                        -{t.amount.toLocaleString()} KZT
                      </p>
                      {t.note && t.note !== 'Без описания' && (
                        <p className="text-xs text-gray-400">{t.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              variant="outline"
              onClick={handleExportExcel}
              loading={exporting === 'excel'}
              className="flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPDF}
              loading={exporting === 'pdf'}
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              onClick={handleBackup}
              loading={backupLoading}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Бэкап
            </Button>
            <Button
              variant="outline"
              onClick={handleRestore}
              loading={restoreLoading}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Восстановить
            </Button>
          </div>
          <p className="text-xs text-gray-500 text-center">
            Последний бэкап: {formatLastBackupLabel()}
          </p>
        </>
      )}
    </div>
  )
}

export default ReportsPage
