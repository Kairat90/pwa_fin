import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Wallet,
  FolderOpen,
  Receipt,
  Repeat,
  Clock,
  Contact,
  HandCoins,
  PieChart,
  LogOut,
  Settings
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../utils/cn'
import { ICON_16 } from '../../utils/iconSize'

export function Sidebar() {
  const { logout } = useAuth()

  const links = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Дашборд' },
    { to: '/accounts', icon: Wallet, label: 'Счета' },
    { to: '/categories', icon: FolderOpen, label: 'Категории' },
    { to: '/transactions', icon: Receipt, label: 'Транзакции' },
    { to: '/transfers', icon: Repeat, label: 'Переводы' },
    { to: '/scheduled', icon: Clock, label: 'Планировщик' },
    { to: '/contacts', icon: Contact, label: 'Контакты' },
    { to: '/debts', icon: HandCoins, label: 'Долги' },
    { to: '/reports', icon: PieChart, label: 'Отчеты' },
    { to: '/settings', icon: Settings, label: 'Настройки' }
  ]

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-screen sticky top-0">
      <div className="p-6">
        <h1 className="text-xl font-bold text-primary-600">💰 Учет</h1>
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-900/50 dark:text-primary-300'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
              )
            }
          >
            <Icon className={ICON_16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        >
          <LogOut className={ICON_16} />
          Выйти
        </button>
      </div>
    </aside>
  )
}
