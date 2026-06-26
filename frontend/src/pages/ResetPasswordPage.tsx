import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Lock, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { supabaseApi, getErrorMessage } from '../api/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { LoadingSpinner } from '../components/common/LoadingSpinner'

const passwordSchema = z.object({
  password: z.string().min(6, 'Минимум 6 символов'),
  confirmPassword: z.string().min(6, 'Подтвердите пароль')
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword']
})

type PasswordFormData = z.infer<typeof passwordSchema>

/** Установка нового пароля по ссылке из письма */
const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [canReset, setCanReset] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema)
  })

  useEffect(() => {
    let cancelled = false

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!cancelled) {
        setCanReset(!!session)
        setChecking(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setCanReset(true)
        setChecking(false)
      }
    })

    void checkSession()

    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setChecking(false)
      }
    }, 2500)

    return () => {
      cancelled = true
      subscription.unsubscribe()
      window.clearTimeout(timeout)
    }
  }, [])

  const onSubmit = async (data: PasswordFormData) => {
    try {
      setLoading(true)
      await supabaseApi.auth.changePassword(data.password)
      await supabaseApi.auth.signOut()
      toast.success('Пароль обновлён. Войдите с новым паролем.')
      navigate('/login', { replace: true })
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Не удалось сменить пароль')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-950 dark:to-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!canReset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-950 dark:to-gray-900 p-4">
        <Card className="w-full max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Ссылка недействительна</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Срок действия ссылки истёк или она уже использована. Запросите восстановление пароля снова.
          </p>
          <Link to="/forgot-password">
            <Button type="button" fullWidth>Запросить новую ссылку</Button>
          </Link>
          <Link to="/login" className="block text-sm text-primary-600 dark:text-primary-400 font-medium">
            Вернуться ко входу
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-950 dark:to-gray-900 p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-900/40 rounded-full mb-4">
            <KeyRound className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Новый пароль</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Придумайте новый пароль для входа</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Новый пароль"
            type="password"
            placeholder="Минимум 6 символов"
            icon={<Lock className="w-5 h-5" />}
            error={errors.password?.message}
            {...register('password')}
          />

          <Input
            label="Подтвердите пароль"
            type="password"
            placeholder="••••••••"
            icon={<Lock className="w-5 h-5" />}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <Button type="submit" fullWidth loading={loading} className="mt-2">
            Сохранить пароль
          </Button>
        </form>
      </Card>
    </div>
  )
}

export default ResetPasswordPage
