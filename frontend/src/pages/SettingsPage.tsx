import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { User, Lock, Trash2, AlertTriangle } from 'lucide-react'
import { supabaseApi, getErrorMessage } from '../api/supabase'
import { useAuth } from '../context/AuthContext'
import { CURRENCIES } from '../utils/currency'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { ICON_16 } from '../utils/iconSize'

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
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

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
          <Lock className={ICON_16} />
          <h2 className="text-lg font-semibold text-gray-900">Смена пароля</h2>
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
