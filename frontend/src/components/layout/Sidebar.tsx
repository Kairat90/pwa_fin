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
  LogOut
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../utils/cn'

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
    { to: '/reports', icon: PieChart, label: 'Отчеты' }
  ]

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 bg-white border-r border-gray-200 h-screen sticky top-0">
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
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-200">
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Выйти
        </button>
      </div>
    </aside>
  )
}
