import React, { useRef } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  /** Без аргумента — текущее value; при очистке передаётся '' */
  onSearch: (query?: string) => void
  placeholder?: string
  className?: string
}

/** Поле поиска: Enter / «Найти»; очистка сразу сбрасывает результаты */
export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = 'Поиск...',
  className
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const hasValue = value.length > 0

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSearch()
    }
  }

  const handleClear = () => {
    onChange('')
    onSearch('')
    inputRef.current?.focus()
  }

  return (
    <div className={cn('flex flex-1 gap-2', className)}>
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full pl-9 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500',
            hasValue ? 'pr-9' : 'pr-4'
          )}
        />
        {hasValue && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Очистить поиск"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <Button type="button" variant="outline" onClick={() => onSearch()} className="shrink-0">
        Найти
      </Button>
    </div>
  )
}
