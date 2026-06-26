import React, { useState } from 'react'
import { Plus, X, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '../utils/cn'

interface QuickAddFabProps {
  onAddExpense: () => void
  onAddIncome: () => void
}

/** Плавающая кнопка быстрого добавления транзакции (мобильные) */
export const QuickAddFab: React.FC<QuickAddFabProps> = ({ onAddExpense, onAddIncome }) => {
  const [open, setOpen] = useState(false)

  const handleExpense = () => {
    setOpen(false)
    onAddExpense()
  }

  const handleIncome = () => {
    setOpen(false)
    onAddIncome()
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 md:hidden flex flex-col items-end gap-3">
      {open && (
        <>
          <button
            type="button"
            onClick={handleExpense}
            className="flex items-center gap-2 pl-4 pr-3 py-2.5 rounded-full bg-red-600 text-white shadow-lg active:scale-95 transition-transform"
          >
            <span className="text-sm font-medium">Расход</span>
            <TrendingDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleIncome}
            className="flex items-center gap-2 pl-4 pr-3 py-2.5 rounded-full bg-green-600 text-white shadow-lg active:scale-95 transition-transform"
          >
            <span className="text-sm font-medium">Доход</span>
            <TrendingUp className="w-4 h-4" />
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Закрыть меню' : 'Добавить транзакцию'}
        className={cn(
          'w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all active:scale-95',
          open ? 'bg-gray-700 rotate-0' : 'bg-primary-600'
        )}
      >
        {open ? <X className="w-6 h-6" /> : <Plus className="w-7 h-7" />}
      </button>
    </div>
  )
}
