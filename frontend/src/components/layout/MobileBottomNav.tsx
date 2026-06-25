import { NavLink } from 'react-router-dom'
import { Home, Receipt, Repeat, Users, PieChart } from 'lucide-react'
import { cn } from '../../utils/cn'

export function MobileBottomNav() {
  const links = [
    { to: '/dashboard', icon: Home, label: 'Главная' },
    { to: '/transactions', icon: Receipt, label: 'Траты' },
    { to: '/transfers', icon: Repeat, label: 'Переводы' },
    { to: '/debts', icon: Users, label: 'Долги' },
    { to: '/reports', icon: PieChart, label: 'Отчеты' }
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50">
      <div className="flex items-center justify-around h-16">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 text-xs transition-colors',
                isActive ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
              )
            }
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
