import React from 'react'
import { cn } from '../../utils/cn'

interface ReportCardProps {
  title: string
  value: number | string
  icon: React.ReactNode
  color?: string
  subtitle?: string
  trend?: number
}

export const ReportCard: React.FC<ReportCardProps> = ({
  title,
  value,
  icon,
  color = 'text-primary-600',
  subtitle,
  trend
}) => {
  return (
    <div className="bg-white rounded-xl border p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-lg', color.replace('text-', 'bg-').replace('600', '50'))}>
            <span className={color}>{icon}</span>
          </div>
          <span className="text-sm text-gray-500">{title}</span>
        </div>
        {trend !== undefined && (
          <span className={cn(
            'text-xs font-medium',
            trend >= 0 ? 'text-green-600' : 'text-red-600'
          )}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-2">
        <span className={cn('text-2xl font-bold', color)}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {subtitle && (
          <span className="ml-2 text-sm text-gray-400">{subtitle}</span>
        )}
      </div>
    </div>
  )
}
