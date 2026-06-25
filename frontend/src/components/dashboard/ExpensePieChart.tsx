import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { CategoryBreakdown } from '../../api/supabase'

interface ExpensePieChartProps {
  data: CategoryBreakdown[]
  type?: 'income' | 'expense'
}

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

export const ExpensePieChart: React.FC<ExpensePieChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Нет данных за этот период
      </div>
    )
  }

  const chartData = data.slice(0, 6).map((item) => ({
    name: `${item.icon} ${item.name}`,
    value: item.amount,
    percentage: item.percentage,
    color: item.color || COLORS[0]
  }))

  if (data.length > 6) {
    const otherTotal = data.slice(6).reduce((sum, item) => sum + item.amount, 0)
    const otherPercentage = data.slice(6).reduce((sum, item) => sum + item.percentage, 0)
    chartData.push({
      name: '📦 Прочее',
      value: otherTotal,
      percentage: otherPercentage,
      color: '#9CA3AF'
    })
  }

  const total = data.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color || COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [
              `${value.toLocaleString('ru-RU')} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
              'Сумма'
            ]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
