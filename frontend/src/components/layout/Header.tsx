import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { LogOut, User, Settings } from 'lucide-react'
import { ICON_16 } from '../../utils/iconSize'
import { Button } from '../ui/Button'

export function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
      <div className="md:hidden">
        <h1 className="text-lg font-bold text-primary-600">💰 Учет</h1>
      </div>
      <div className="hidden md:block text-sm text-gray-500 dark:text-gray-400">
        Финансовый учет
      </div>
      <div className="flex items-center gap-2">
        <Link
          to="/settings"
          className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <User className={ICON_16} />
          <span className="max-w-[120px] sm:max-w-none truncate">{user?.name || user?.email}</span>
        </Link>
        <Link
          to="/settings"
          className="p-2 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          title="Настройки"
        >
          <Settings className={ICON_16} />
        </Link>
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className={ICON_16} />
        </Button>
      </div>
    </header>
  )
}
