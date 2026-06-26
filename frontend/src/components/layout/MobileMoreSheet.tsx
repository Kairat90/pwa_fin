import { NavLink } from 'react-router-dom'
import {
  Wallet,
  FolderOpen,
  Repeat,
  Clock,
  Contact,
  X,
  Settings
} from 'lucide-react'
import { cn } from '../../utils/cn'
import { ICON_16 } from '../../utils/iconSize'

interface MobileMoreSheetProps {
  isOpen: boolean
  onClose: () => void
}

const moreLinks = [
  { to: '/accounts', icon: Wallet, label: 'Счета' },
  { to: '/categories', icon: FolderOpen, label: 'Категории' },
  { to: '/transfers', icon: Repeat, label: 'Переводы' },
  { to: '/scheduled', icon: Clock, label: 'Планировщик' },
  { to: '/contacts', icon: Contact, label: 'Контакты' },
  { to: '/settings', icon: Settings, label: 'Настройки' }
]

export function MobileMoreSheet({ isOpen, onClose }: MobileMoreSheetProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Закрыть меню"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-xl pb-safe">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ещё</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <X className={ICON_16} />
          </button>
        </div>
        <nav className="p-2 pb-4">
          {moreLinks.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-base transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-900/50 dark:text-primary-300'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                )
              }
            >
              <Icon className={ICON_16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
