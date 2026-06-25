import React, { useState } from 'react'
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Calendar, ChevronDown } from 'lucide-react'
import { Button } from '../ui/Button'

interface DateRangePickerProps {
  startDate: Date
  endDate: Date
  onRangeChange: (start: Date, end: Date) => void
}

const PRESETS = [
  { label: 'Сегодня', get: () => ({ start: new Date(), end: new Date() }) },
  { label: 'Вчера', get: () => ({ start: subDays(new Date(), 1), end: subDays(new Date(), 1) }) },
  { label: 'Последние 7 дней', get: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
  { label: 'Последние 30 дней', get: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
  { label: 'Этот месяц', get: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
  {
    label: 'Прошлый месяц',
    get: () => {
      const date = subMonths(new Date(), 1)
      return { start: startOfMonth(date), end: endOfMonth(date) }
    }
  }
]

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onRangeChange
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [localStart, setLocalStart] = useState(format(startDate, 'yyyy-MM-dd'))
  const [localEnd, setLocalEnd] = useState(format(endDate, 'yyyy-MM-dd'))

  const handlePreset = (preset: (typeof PRESETS)[0]) => {
    const { start, end } = preset.get()
    onRangeChange(start, end)
    setLocalStart(format(start, 'yyyy-MM-dd'))
    setLocalEnd(format(end, 'yyyy-MM-dd'))
    setIsOpen(false)
  }

  const handleApply = () => {
    onRangeChange(new Date(localStart), new Date(localEnd))
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Calendar className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-700">
          {format(startDate, 'dd MMM yyyy', { locale: ru })} — {format(endDate, 'dd MMM yyyy', { locale: ru })}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 bg-white rounded-xl shadow-lg border p-4 z-50 w-80">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className="px-3 py-1.5 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">С</label>
                  <input
                    type="date"
                    value={localStart}
                    onChange={(e) => setLocalStart(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">По</label>
                  <input
                    type="date"
                    value={localEnd}
                    onChange={(e) => setLocalEnd(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <Button
                size="sm"
                fullWidth
                className="mt-2"
                onClick={handleApply}
              >
                Применить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
