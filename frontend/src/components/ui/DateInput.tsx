import React, { useCallback } from 'react'
import { cn } from '../../utils/cn'

type DateInputType = 'date' | 'datetime-local'

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  error?: string
  type?: DateInputType
}

const ALLOWED_KEYS = new Set([
  'Tab',
  'Escape',
  'Enter',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'Backspace',
  'Delete'
])

function openNativePicker(input: HTMLInputElement) {
  try {
    if (typeof input.showPicker === 'function') {
      input.showPicker()
    }
  } catch {
    // Браузер может запретить showPicker вне жеста пользователя
  }
}

/** Дата только через календарик (без ручного набора цифр) */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ label, error, className, type = 'date', onFocus, onClick, onKeyDown, ...props }, ref) => {
    const handleFocus = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        openNativePicker(event.currentTarget)
        onFocus?.(event)
      },
      [onFocus]
    )

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLInputElement>) => {
        openNativePicker(event.currentTarget)
        onClick?.(event)
      },
      [onClick]
    )

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault()
          openNativePicker(event.currentTarget)
          onKeyDown?.(event)
          return
        }

        if (!ALLOWED_KEYS.has(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault()
        }

        onKeyDown?.(event)
      },
      [onKeyDown]
    )

    return (
      <div className="w-full min-w-0">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type={type}
          inputMode="none"
          className={cn(
            'w-full min-w-0 max-w-full box-border rounded-lg border border-gray-300 dark:border-gray-600',
            'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
            'px-3 sm:px-4 py-2.5 text-base',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            'transition-colors duration-200 appearance-none',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          {...props}
          onFocus={handleFocus}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    )
  }
)

DateInput.displayName = 'DateInput'

export default DateInput
