import React, { useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts'
import { CategoryBreakdown } from '../../api/supabase'
import { cn } from '../../utils/cn'

interface CategoryChartProps {
  data: CategoryBreakdown[]
  type: 'income' | 'expense'
  chartType?: 'pie' | 'bar'
}

const COLORS = [
  '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6B7280', '#1F2937'
]

export const CategoryChart: React.FC<CategoryChartProps> = ({
  data,
  chartType: defaultChartType = 'pie'
}) => {
  const [chartType, setChartType] = useState<'pie' | 'bar'>(defaultChartType)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Нет данных за этот период
      </div>
    )
  }

  const chartData = data.slice(0, 8).map((item) => ({
    name: `${item.icon} ${item.name}`,
    value: item.amount,
    percentage: item.percentage,
    color: item.color || COLORS[0],
    count: item.count
  }))

  if (data.length > 8) {
    const otherTotal = data.slice(8).reduce((sum, item) => sum + item.amount, 0)
    const otherPercentage = data.slice(8).reduce((sum, item) => sum + item.percentage, 0)
    chartData.push({
      name: '📦 Прочее',
      value: otherTotal,
      percentage: otherPercentage,
      color: '#9CA3AF',
      count: data.slice(8).reduce((sum, item) => sum + item.count, 0)
    })
  }

  const total = data.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div>
      <div className="flex justify-end gap-1 mb-4">
        <button
          type="button"
          onClick={() => setChartType('pie')}
          className={cn(
            'px-3 py-1 text-sm rounded-lg transition-colors',
            chartType === 'pie'
              ? 'bg-primary-100 text-primary-700'
              : 'text-gray-500 hover:bg-gray-100'
          )}
        >
          Круговая
        </button>
        <button
          type="button"
          onClick={() => setChartType('bar')}
          className={cn(
            'px-3 py-1 text-sm rounded-lg transition-colors',
            chartType === 'bar'
              ? 'bg-primary-100 text-primary-700'
              : 'text-gray-500 hover:bg-gray-100'
          )}
        >
          Столбчатая
        </button>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'pie' ? (
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [
                  `${value.toLocaleString()} (${((value / total) * 100).toFixed(1)}%)`,
                  'Сумма'
                ]}
              />
              <Legend />
            </PieChart>
          ) : (
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={(value) => value.toLocaleString()} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) => [value.toLocaleString(), 'Сумма']}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
