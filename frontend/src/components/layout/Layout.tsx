import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MobileBottomNav } from './MobileBottomNav'
import { BackupReminderBanner } from '../common/BackupReminderBanner'
import { useAuth } from '../../context/AuthContext'
import { useBackupScheduler } from '../../hooks/useBackupScheduler'

export function Layout() {
  const { isAuthenticated } = useAuth()
  const { showReminder, backupLoading, dismissReminder, runBackup } = useBackupScheduler(isAuthenticated)

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
          {showReminder && (
            <BackupReminderBanner
              onBackup={runBackup}
              onDismiss={dismissReminder}
              loading={backupLoading}
            />
          )}
          <Outlet />
        </main>
        <MobileBottomNav />
      </div>
    </div>
  )
}

export default Layout
