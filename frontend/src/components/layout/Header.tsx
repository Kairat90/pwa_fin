import { useAuth } from '../../context/AuthContext'
import { LogOut, User } from 'lucide-react'
import { Button } from '../ui/Button'

export function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="md:hidden">
        <h1 className="text-lg font-bold text-primary-600">💰 Учет</h1>
      </div>
      <div className="hidden md:block text-sm text-gray-500">
        Финансовый учет
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <User size={18} />
          <span>{user?.name || user?.email}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut size={18} />
        </Button>
      </div>
    </header>
  )
}
