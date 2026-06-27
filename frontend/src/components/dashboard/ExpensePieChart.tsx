import React, { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { CategoryBreakdown } from '../../api/supabase'
import { CHART_OTHER_COLOR, buildChartPalette, PIE_CHART_LAYOUT_COMPACT } from '../../utils/chartColors'

interface ExpensePieChartProps {
  data: CategoryBreakdown[]
  type?: 'income' | 'expense'
}

export const ExpensePieChart: React.FC<ExpensePieChartProps> = ({ data }) => {
  const chartData = useMemo(() => {
    if (data.length === 0) {
      return []
    }

    const topItems = data.slice(0, 6)
    const hasOther = data.length > 6
    const palette = buildChartPalette(
      topItems.length + (hasOther ? 1 : 0),
      topItems.map((item) => item.id).join('|')
    )

    const items = topItems.map((item, index) => ({
      name: `${item.icon} ${item.name}`,
      value: item.amount,
      percentage: item.percentage,
      color: palette[index]
    }))

    if (hasOther) {
      const otherTotal = data.slice(6).reduce((sum, item) => sum + item.amount, 0)
      const otherPercentage = data.slice(6).reduce((sum, item) => sum + item.percentage, 0)
      items.push({
        name: '📦 Прочее',
        value: otherTotal,
        percentage: otherPercentage,
        color: CHART_OTHER_COLOR
      })
    }

    return items
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Нет данных за этот период
      </div>
    )
  }

  const total = data.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div className="h-72 sm:h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={PIE_CHART_LAYOUT_COMPACT.margin}>
          <Pie
            data={chartData}
            cx={PIE_CHART_LAYOUT_COMPACT.pie.cx}
            cy={PIE_CHART_LAYOUT_COMPACT.pie.cy}
            innerRadius={52}
            outerRadius={72}
            paddingAngle={PIE_CHART_LAYOUT_COMPACT.pie.paddingAngle}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [
              `${value.toLocaleString('ru-RU')} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
              'Сумма'
            ]}
          />
          <Legend {...PIE_CHART_LAYOUT_COMPACT.legend} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
