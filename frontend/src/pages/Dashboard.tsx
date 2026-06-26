import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabaseApi } from '../api/supabase'
import { Transaction } from '../types'
import { useAuth } from '../context/AuthContext'
import { SummaryCards } from '../components/dashboard/SummaryCards'
import { ExpensePieChart } from '../components/dashboard/ExpensePieChart'
import { BalanceChart } from '../components/dashboard/BalanceChart'
import { RecentTransactions } from '../components/dashboard/RecentTransactions'
import { QuickAddFab } from '../components/dashboard/QuickAddFab'
import { PeriodComparisonCard } from '../components/dashboard/PeriodComparisonCard'
import { TransactionForm } from '../components/transactions/TransactionForm'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { cn } from '../utils/cn'
import { formatCurrency } from '../utils/currency'

type Period = 'month' | 'week' | 'today'

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { defaultCurrency } = useAuth()
  const [period, setPeriod] = useState<Period>('month')
  const [startDate, setStartDate] = useState(startOfMonth(new Date()))
  const [endDate, setEndDate] = useState(endOfMonth(new Date()))
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<'income' | 'expense'>('expense')

  const startStr = format(startDate, 'yyyy-MM-dd')
  const endStr = format(endDate, 'yyyy-MM-dd')

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['summary', startStr, endStr],
    queryFn: () => supabaseApi.reports.getSummary(startStr, endStr)
  })

  const { data: comparison, isLoading: comparisonLoading } = useQuery({
    queryKey: ['comparison', startStr, endStr],
    queryFn: () => supabaseApi.reports.getComparison(startStr, endStr)
  })

  const { data: expenseCategories } = useQuery({
    queryKey: ['expenseCategories', startStr, endStr],
    queryFn: () => supabaseApi.reports.getCategoryBreakdown(startStr, endStr, 'expense')
  })

  const { data: balanceHistory } = useQuery({
    queryKey: ['balanceHistory', startStr, endStr],
    queryFn: () => supabaseApi.reports.getBalanceHistory(startStr, endStr)
  })

  const { data: topTransactions } = useQuery({
    queryKey: ['topTransactions', startStr, endStr],
    queryFn: () => supabaseApi.reports.getTopTransactions(startStr, endStr, 5)
  })

  const { data: totalBalance } = useQuery({
    queryKey: ['totalBalance'],
    queryFn: () => supabaseApi.accounts.getTotalBalance()
  })

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod)
    const now = new Date()

    if (newPeriod === 'today') {
      setStartDate(startOfDay(now))
      setEndDate(endOfDay(now))
    } else if (newPeriod === 'week') {
      setStartDate(startOfDay(subDays(now, 7)))
      setEndDate(endOfDay(now))
    } else {
      setStartDate(startOfMonth(now))
      setEndDate(endOfMonth(now))
    }
  }

  const handleRefresh = async () => {
    await queryClient.invalidateQueries()
    toast.success('Данные обновлены')
  }

  const openForm = (type: 'income' | 'expense') => {
    setFormType(type)
    setShowForm(true)
  }

  const handleFormSuccess = () => {
    queryClient.invalidateQueries()
  }

  const comparisonLabel =
    period === 'month' ? 'к прошлому месяцу' : period === 'week' ? 'к прошлой неделе' : 'к вчера'

  if (summaryLoading) {
    return <LoadingSpinner size="lg" />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>
          <p className="text-gray-500 text-sm">
            {format(startDate, 'dd MMM yyyy', { locale: ru })} — {format(endDate, 'dd MMM yyyy', { locale: ru })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['today', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriodChange(p)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-lg transition-colors',
                  period === p
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {p === 'today' ? 'Сегодня' : p === 'week' ? 'Неделя' : 'Месяц'}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Обновить
          </Button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 text-white">
        <p className="text-sm opacity-90">Общий баланс</p>
        <p className="text-3xl font-bold mt-1">
          {formatCurrency(totalBalance || 0, defaultCurrency)}
        </p>
        <div className="flex gap-4 mt-4 flex-wrap">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate('/transactions')}
            className="bg-white/20 hover:bg-white/30 text-white border-0"
          >
            Все транзакции
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate('/accounts')}
            className="bg-white/20 hover:bg-white/30 text-white border-0"
          >
            Управление счетами
          </Button>
        </div>
      </div>

      {summary && (
        <SummaryCards
          totalIncome={summary.totalIncome}
          totalExpense={summary.totalExpense}
          netFlow={summary.netFlow}
          transactionCount={summary.transactionCount}
        />
      )}

      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Сравнение с прошлым периодом</h3>
        {comparisonLoading && <LoadingSpinner />}
        {comparison && !comparisonLoading && (
          <PeriodComparisonCard
            data={comparison}
            currency={defaultCurrency}
            periodLabel={comparisonLabel}
          />
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Динамика баланса</h3>
          {balanceHistory && <BalanceChart data={balanceHistory} />}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Структура расходов</h3>
          {expenseCategories && <ExpensePieChart data={expenseCategories} type="expense" />}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Последние траты</h3>
          <Button variant="outline" size="sm" onClick={() => navigate('/transactions')}>
            Все транзакции
          </Button>
        </div>
        {topTransactions && (
          <RecentTransactions
            transactions={topTransactions}
            onViewAll={() => navigate('/transactions')}
          />
        )}
      </Card>

      <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button
          onClick={() => openForm('expense')}
          className="h-20 flex flex-col items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
        >
          <span className="text-2xl">💳</span>
          <span className="text-sm">Добавить расход</span>
        </Button>
        <Button
          onClick={() => openForm('income')}
          className="h-20 flex flex-col items-center justify-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200"
        >
          <span className="text-2xl">💰</span>
          <span className="text-sm">Добавить доход</span>
        </Button>
        <Button
          onClick={() => navigate('/transfers')}
          className="h-20 flex flex-col items-center justify-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
        >
          <span className="text-2xl">🔄</span>
          <span className="text-sm">Перевод</span>
        </Button>
        <Button
          onClick={() => navigate('/debts')}
          className="h-20 flex flex-col items-center justify-center gap-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200"
        >
          <span className="text-2xl">🤝</span>
          <span className="text-sm">Долги</span>
        </Button>
      </div>

      <QuickAddFab onAddExpense={() => openForm('expense')} onAddIncome={() => openForm('income')} />

      <TransactionForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={handleFormSuccess}
        type={formType}
      />
    </div>
  )
}

export default Dashboard
