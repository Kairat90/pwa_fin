import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'
import { ICON_16 } from '../../utils/iconSize'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Выше обычного на мобильных (нижний sheet) */
  tallMobile?: boolean
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  tallMobile = false
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl'
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full flex flex-col min-w-0 overflow-hidden',
          'rounded-b-none sm:rounded-b-2xl',
          tallMobile ? 'max-h-[92dvh] min-h-[min(82dvh,40rem)] sm:min-h-0 sm:max-h-[90vh]' : 'max-h-[92dvh] sm:max-h-[90vh]',
          sizes[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 pr-2">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
          >
            <X className={ICON_16} />
          </button>
        </div>
        <div
          className={cn(
            'p-4 sm:p-6 flex-1 min-h-0 min-w-0 flex flex-col',
            tallMobile ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export default Modal
