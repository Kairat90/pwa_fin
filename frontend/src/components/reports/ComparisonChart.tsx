import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ComparisonReport } from '../../api/supabase'

interface ComparisonChartProps {
  data: ComparisonReport
}

export const ComparisonChart: React.FC<ComparisonChartProps> = ({ data }) => {
  const chartData = [
    {
      name: 'Доходы',
      current: data.current.totalIncome,
      previous: data.previous.totalIncome,
      change: data.changes.income
    },
    {
      name: 'Расходы',
      current: data.current.totalExpense,
      previous: data.previous.totalExpense,
      change: data.changes.expense
    },
    {
      name: 'Чистый поток',
      current: data.current.netFlow,
      previous: data.previous.netFlow,
      change: data.changes.netFlow
    }
  ]

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" />
          <YAxis tickFormatter={(value) => value.toLocaleString()} />
          <Tooltip
            formatter={(value: number) => value.toLocaleString()}
            labelFormatter={(label) => `📊 ${label}`}
          />
          <Bar dataKey="current" fill="#4F46E5" radius={[4, 4, 0, 0]} name="Текущий период" />
          <Bar dataKey="previous" fill="#9CA3AF" radius={[4, 4, 0, 0]} name="Предыдущий период" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
