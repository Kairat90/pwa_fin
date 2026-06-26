import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { User, Lock, Trash2, AlertTriangle, Moon, Save } from 'lucide-react'
import { supabaseApi, getErrorMessage } from '../api/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { CURRENCIES } from '../utils/currency'
import { THEME_OPTIONS } from '../utils/theme'
import { cn } from '../utils/cn'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { ICON_16 } from '../utils/iconSize'
import {
  getBackupSettings,
  saveBackupSettings,
  formatLastBackupLabel,
  BACKUP_INTERVAL_DAYS,
  type BackupScheduleSettings
} from '../utils/backupSchedule'
import { createAndExportBackup } from '../utils/backupExport'

const profileSchema = z.object({
  name: z.string().min(1, 'Введите имя').max(100, 'Слишком длинное имя'),
  defaultCurrency: z.string().min(1, 'Выберите валюту')
})

const passwordSchema = z.object({
  newPassword: z.string().min(6, 'Минимум 6 символов'),
  confirmPassword: z.string().min(6, 'Подтвердите пароль')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword']
})

type ProfileFormData = z.infer<typeof profileSchema>
type PasswordFormData = z.infer<typeof passwordSchema>

const SettingsPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, setUserProfile, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [backupSettings, setBackupSettings] = useState<BackupScheduleSettings>(() => getBackupSettings())
  const [backupLoading, setBackupLoading] = useState(false)
  const [lastBackupLabel, setLastBackupLabel] = useState(formatLastBackupLabel())

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: {
      name: user?.name || '',
      defaultCurrency: user?.defaultCurrency || 'KZT'
    }
  })

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' }
  })

  const onSaveProfile = async (data: ProfileFormData) => {
    try {
      setProfileLoading(true)
      const updated = await supabaseApi.auth.updateProfile({
        name: data.name.trim(),
        defaultCurrency: data.defaultCurrency
      })
      setUserProfile(updated)
      toast.success('Настройки сохранены')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Ошибка сохранения')
    } finally {
      setProfileLoading(false)
    }
  }

  const onChangePassword = async (data: PasswordFormData) => {
    try {
      setPasswordLoading(true)
      await supabaseApi.auth.changePassword(data.newPassword)
      passwordForm.reset()
      toast.success('Пароль изменён')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Ошибка смены пароля')
    } finally {
      setPasswordLoading(false)
    }
  }

  const updateBackupSettings = (patch: Partial<BackupScheduleSettings>) => {
    const next = { ...backupSettings, ...patch }
    setBackupSettings(next)
    saveBackupSettings(next)
    toast.success('Настройки бэкапа сохранены')
  }

  const onCreateBackupNow = async () => {
    try {
      setBackupLoading(true)
      const method = await createAndExportBackup()
      setLastBackupLabel(formatLastBackupLabel())
      toast.success(
        method === 'share'
          ? 'Бэкап готов — выберите приложение для сохранения'
          : 'Бэкап сохранён в файл'
      )
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      toast.error(getErrorMessage(error) || 'Ошибка создания бэкапа')
    } finally {
      setBackupLoading(false)
    }
  }

  const onDeleteAccount = async () => {
    if (deleteConfirm !== user?.email) {
      toast.error('Введите email для подтверждения')
      return
    }

    try {
      setDeleteLoading(true)
      await supabaseApi.auth.deleteAccount()
      logout()
      toast.success('Аккаунт удалён')
      navigate('/login', { replace: true })
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Не удалось удалить аккаунт. Выполните SQL migrations/20250111_user_settings.sql')
    } finally {
      setDeleteLoading(false)
      setShowDeleteModal(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
        <p className="text-gray-500 text-sm mt-1">{user?.email}</p>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <User className={ICON_16} />
          <h2 className="text-lg font-semibold text-gray-900">Профиль</h2>
        </div>
        <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4">
          <Input
            label="Имя"
            placeholder="Как к вам обращаться"
            error={profileForm.formState.errors.name?.message}
            {...profileForm.register('name')}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Валюта по умолчанию</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              {...profileForm.register('defaultCurrency')}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Используется на дашборде и в отчётах, если у счёта не указана своя валюта
            </p>
          </div>
          <Button type="submit" loading={profileLoading}>Сохранить</Button>
        </form>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Moon className={ICON_16} />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Тема оформления</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setTheme(option.value)
                toast.success(
                  option.value === 'system'
                    ? 'Тема: как в системе'
                    : option.value === 'dark'
                      ? 'Тёмная тема включена'
                      : 'Светлая тема включена'
                )
              }}
              className={cn(
                'p-4 rounded-xl border-2 text-left transition-colors',
                theme === option.value
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/40'
                  : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
              )}
            >
              <p className="font-medium text-gray-900 dark:text-gray-100">{option.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{option.description}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Lock className={ICON_16} />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Смена пароля</h2>
        </div>
        <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
          <Input
            label="Новый пароль"
            type="password"
            placeholder="Минимум 6 символов"
            error={passwordForm.formState.errors.newPassword?.message}
            {...passwordForm.register('newPassword')}
          />
          <Input
            label="Подтвердите пароль"
            type="password"
            error={passwordForm.formState.errors.confirmPassword?.message}
            {...passwordForm.register('confirmPassword')}
          />
          <Button type="submit" variant="secondary" loading={passwordLoading}>Изменить пароль</Button>
        </form>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Save className={ICON_16} />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Автобэкап</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Последний бэкап: {lastBackupLabel}. Рекомендуется сохранять копию раз в {BACKUP_INTERVAL_DAYS} дней.
        </p>
        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={backupSettings.reminderEnabled}
              onChange={(e) => updateBackupSettings({ reminderEnabled: e.target.checked })}
            />
            <span>
              <span className="font-medium text-gray-900 dark:text-gray-100 block">
                Еженедельное напоминание
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Баннер «Сделайте бэкап», если прошло {BACKUP_INTERVAL_DAYS} дней
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={backupSettings.autoExport}
              onChange={(e) => updateBackupSettings({ autoExport: e.target.checked })}
            />
            <span>
              <span className="font-medium text-gray-900 dark:text-gray-100 block">
                Автосохранение при напоминании
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                При входе в приложение создаётся файл бэкапа. На телефоне — через «Поделиться» (Share API).
              </span>
            </span>
          </label>
          <Button type="button" variant="outline" loading={backupLoading} onClick={() => void onCreateBackupNow()}>
            Создать бэкап сейчас
          </Button>
        </div>
      </Card>

      <Card className="border-red-200 bg-red-50/50">
        <div className="flex items-center gap-2 mb-2">
          <Trash2 className={`${ICON_16} text-red-600`} />
          <h2 className="text-lg font-semibold text-red-800">Удаление аккаунта</h2>
        </div>
        <p className="text-sm text-red-700 mb-4">
          Будут безвозвратно удалены все счета, транзакции, долги и другие данные. Это действие нельзя отменить.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="border-red-300 text-red-700 hover:bg-red-100"
          onClick={() => {
            setDeleteConfirm('')
            setShowDeleteModal(true)
          }}
        >
          Удалить аккаунт
        </Button>
      </Card>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Удалить аккаунт?"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex gap-3 p-3 bg-red-50 rounded-lg text-red-800 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>
              Все ваши данные будут удалены навсегда. Для подтверждения введите email:{' '}
              <strong>{user?.email}</strong>
            </p>
          </div>
          <Input
            label="Email для подтверждения"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={user?.email}
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowDeleteModal(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              className="flex-1 bg-red-600 hover:bg-red-700"
              loading={deleteLoading}
              disabled={deleteConfirm !== user?.email}
              onClick={onDeleteAccount}
            >
              Удалить навсегда
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default SettingsPage
