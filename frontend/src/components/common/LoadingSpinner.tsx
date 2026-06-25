import React from 'react'
import { cn } from '../../utils/cn'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className
}) => {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  }

  return (
    <div className={cn('flex items-center justify-center min-h-[200px]', className)}>
      <div className={cn(
        'animate-spin rounded-full border-4 border-primary-200',
        'border-t-primary-600',
        sizes[size]
      )} />
    </div>
  )
}

export default LoadingSpinner
