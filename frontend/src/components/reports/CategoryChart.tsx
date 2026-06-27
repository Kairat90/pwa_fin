import React, { useMemo, useState } from 'react'
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
import { CHART_OTHER_COLOR, buildChartPalette, PIE_CHART_LAYOUT } from '../../utils/chartColors'
import { formatPieLegendLabel, renderPiePercentLabel } from '../../utils/pieChartLabels'

interface CategoryChartProps {
  data: CategoryBreakdown[]
  type: 'income' | 'expense'
  chartType?: 'pie' | 'bar'
}

export const CategoryChart: React.FC<CategoryChartProps> = ({
  data,
  chartType: defaultChartType = 'pie'
}) => {
  const [chartType, setChartType] = useState<'pie' | 'bar'>(defaultChartType)

  const chartData = useMemo(() => {
    const topItems = data.slice(0, 8)
    const hasOther = data.length > 8
    const palette = buildChartPalette(
      topItems.length + (hasOther ? 1 : 0),
      topItems.map((item) => item.id).join('|')
    )

    const items = topItems.map((item, index) => ({
      name: `${item.icon} ${item.name}`,
      value: item.amount,
      percentage: item.percentage,
      color: palette[index],
      count: item.count
    }))

    if (hasOther) {
      const otherTotal = data.slice(8).reduce((sum, item) => sum + item.amount, 0)
      const otherPercentage = data.slice(8).reduce((sum, item) => sum + item.percentage, 0)
      items.push({
        name: '📦 Прочее',
        value: otherTotal,
        percentage: otherPercentage,
        color: CHART_OTHER_COLOR,
        count: data.slice(8).reduce((sum, item) => sum + item.count, 0)
      })
    }

    return items
  }, [data])

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Нет данных за этот период
      </div>
    )
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

      <div className={cn('w-full', chartType === 'pie' ? 'h-96 sm:h-[28rem]' : 'h-64')}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'pie' ? (
            <PieChart margin={PIE_CHART_LAYOUT.margin}>
              <Pie
                data={chartData}
                cx={PIE_CHART_LAYOUT.pie.cx}
                cy={PIE_CHART_LAYOUT.pie.cy}
                innerRadius={PIE_CHART_LAYOUT.pie.innerRadius}
                outerRadius={PIE_CHART_LAYOUT.pie.outerRadius}
                paddingAngle={PIE_CHART_LAYOUT.pie.paddingAngle}
                dataKey="value"
                label={renderPiePercentLabel}
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [
                  `${value.toLocaleString()} (${((value / total) * 100).toFixed(1)}%)`,
                  'Сумма'
                ]}
              />
              <Legend
                {...PIE_CHART_LAYOUT.legend}
                formatter={(value: string) => {
                  const item = chartData.find((entry) => entry.name === value)
                  return formatPieLegendLabel(value, item?.percentage)
                }}
              />
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
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
