import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Home, Receipt, Users, PieChart, Menu } from 'lucide-react'
import { cn } from '../../utils/cn'
import { ICON_16 } from '../../utils/iconSize'
import { MobileMoreSheet } from './MobileMoreSheet'

const mainLinks = [
  { to: '/dashboard', icon: Home, label: 'Главная' },
  { to: '/transactions', icon: Receipt, label: 'Траты' },
  { to: '/debts', icon: Users, label: 'Долги' },
  { to: '/reports', icon: PieChart, label: 'Отчёты' }
]

const morePaths = ['/accounts', '/categories', '/transfers', '/scheduled', '/contacts', '/settings']

export function MobileBottomNav() {
  const [showMore, setShowMore] = useState(false)
  const location = useLocation()
  const isMoreActive = morePaths.some((path) => location.pathname.startsWith(path))

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 md:hidden z-50">
        <div className="flex items-center justify-around h-16">
          {mainLinks.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 text-xs transition-colors min-w-[56px]',
                  isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                )
              }
            >
              <Icon className={ICON_16} />
              <span>{label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className={cn(
              'flex flex-col items-center gap-0.5 text-xs transition-colors min-w-[56px]',
              isMoreActive || showMore ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <Menu className={ICON_16} />
            <span>Ещё</span>
          </button>
        </div>
      </nav>
      <MobileMoreSheet isOpen={showMore} onClose={() => setShowMore(false)} />
    </>
  )
}
