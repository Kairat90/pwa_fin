import React from 'react'
import { Search } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  placeholder?: string
  className?: string
}

/** Поле поиска: запрос выполняется по Enter или кнопке «Найти» */
export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = 'Поиск...',
  className
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSearch()
    }
  }

  return (
    <div className={cn('flex flex-1 gap-2', className)}>
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <Button type="button" variant="outline" onClick={onSearch} className="shrink-0">
        Найти
      </Button>
    </div>
  )
}
