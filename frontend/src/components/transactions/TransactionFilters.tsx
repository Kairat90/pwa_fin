import React, { useEffect, useState } from 'react'
import { Filter, X } from 'lucide-react'
import { Account, Category } from '../../types'
import { Button } from '../ui/Button'
import { SearchField } from '../common/SearchField'

export interface TransactionFilterValues {
  search?: string
  accountId?: string
  categoryId?: string
  type?: string
  startDate?: string
  endDate?: string
}

interface TransactionFiltersProps {
  accounts: Account[]
  categories: Category[]
  onFilter: (filters: TransactionFilterValues) => void
  onReset: () => void
  initialFilters?: TransactionFilterValues
}

export const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  accounts,
  categories,
  onFilter,
  onReset,
  initialFilters
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [filters, setFilters] = useState({
    search: initialFilters?.search || '',
    accountId: initialFilters?.accountId || '',
    categoryId: initialFilters?.categoryId || '',
    type: initialFilters?.type || '',
    startDate: initialFilters?.startDate || '',
    endDate: initialFilters?.endDate || ''
  })

  useEffect(() => {
    setFilters({
      search: initialFilters?.search || '',
      accountId: initialFilters?.accountId || '',
      categoryId: initialFilters?.categoryId || '',
      type: initialFilters?.type || '',
      startDate: initialFilters?.startDate || '',
      endDate: initialFilters?.endDate || ''
    })
  }, [
    initialFilters?.search,
    initialFilters?.accountId,
    initialFilters?.categoryId,
    initialFilters?.type,
    initialFilters?.startDate,
    initialFilters?.endDate
  ])

  const handleChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const applyFilters = () => {
    const activeFilters: TransactionFilterValues = {}
    Object.entries(filters).forEach(([key, value]) => {
      if (value) activeFilters[key as keyof TransactionFilterValues] = value
    })
    onFilter(activeFilters)
  }

  const handleSubmit = () => {
    applyFilters()
    setIsOpen(false)
  }

  const handleReset = () => {
    setFilters({
      search: '',
      accountId: '',
      categoryId: '',
      type: '',
      startDate: '',
      endDate: ''
    })
    onReset()
    setIsOpen(false)
  }

  const hasActiveFilters = Object.values(filters).some((v) => v)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <SearchField
          value={filters.search}
          onChange={(value) => handleChange('search', value)}
          onSearch={applyFilters}
          placeholder="Поиск по описанию или тегам..."
        />
        <Button
          variant={hasActiveFilters ? 'primary' : 'outline'}
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1"
        >
          <Filter className="w-4 h-4" />
          Фильтры
          {hasActiveFilters && (
            <span className="ml-1 bg-primary-200 text-primary-800 text-xs px-2 py-0.5 rounded-full">
              {Object.values(filters).filter((v) => v).length}
            </span>
          )}
        </Button>
      </div>

      {isOpen && (
        <div className="bg-white rounded-xl border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Фильтры</h4>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Счет</label>
              <select
                value={filters.accountId}
                onChange={(e) => handleChange('accountId', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Все счета</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.icon} {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
              <select
                value={filters.categoryId}
                onChange={(e) => handleChange('categoryId', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Все категории</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
              <select
                value={filters.type}
                onChange={(e) => handleChange('type', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Все</option>
                <option value="income">Доходы</option>
                <option value="expense">Расходы</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Период</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleChange('startDate', e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="text-gray-400 self-center">—</span>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleChange('endDate', e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={handleReset} className="flex-1">
              Сбросить
            </Button>
            <Button onClick={handleSubmit} className="flex-1">
              Применить
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
