import React from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface BalanceChartProps {
  data: Array<{ date: string; balance: number }>
}

export const BalanceChart: React.FC<BalanceChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Нет данных для графика
      </div>
    )
  }

  const formattedData = data.map((item) => ({
    ...item,
    dateFormatted: format(new Date(item.date), 'dd MMM', { locale: ru })
  }))

  const minBalance = Math.min(...data.map((d) => d.balance))
  const maxBalance = Math.max(...data.map((d) => d.balance))
  const padding = (maxBalance - minBalance) * 0.1 || 1000

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData}>
          <defs>
            <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="dateFormatted" tick={{ fontSize: 12 }} tickMargin={10} />
          <YAxis
            domain={[minBalance - padding, maxBalance + padding]}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => value.toLocaleString('ru-RU')}
            tickMargin={10}
          />
          <Tooltip
            formatter={(value: number) => [value.toLocaleString('ru-RU'), 'Баланс']}
            labelFormatter={(label) => `📅 ${label}`}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#4F46E5"
            strokeWidth={2}
            fill="url(#balanceGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
