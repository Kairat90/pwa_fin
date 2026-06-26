import React from 'react'
import { cn } from '../../utils/cn'

interface CardProps {
  children: React.ReactNode
  className?: string
  title?: string
  action?: React.ReactNode
}

export const Card: React.FC<CardProps> = ({ children, className, title, action }) => {
  if (title || action) {
    return (
      <div className={cn('bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800', className)}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          {title && <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>}
          {action}
        </div>
        <div className="p-4">{children}</div>
      </div>
    )
  }

  return (
    <div className={cn('bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6', className)}>
      {children}
    </div>
  )
}

export default Card
