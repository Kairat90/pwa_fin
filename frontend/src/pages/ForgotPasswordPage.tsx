import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Mail, KeyRound, ArrowLeft } from 'lucide-react'
import { supabaseApi, getErrorMessage } from '../api/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'

const emailSchema = z.object({
  email: z.string().email('Введите корректный email')
})

type EmailFormData = z.infer<typeof emailSchema>

/** Запрос письма для восстановления пароля */
const ForgotPasswordPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema)
  })

  const onSubmit = async (data: EmailFormData) => {
    try {
      setLoading(true)
      await supabaseApi.auth.requestPasswordReset(data.email.trim())
      setSentEmail(data.email.trim())
      setSent(true)
      toast.success('Письмо отправлено')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Не удалось отправить письмо')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-950 dark:to-gray-900 p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-900/40 rounded-full mb-4">
            <KeyRound className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Восстановление пароля</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {sent ? 'Проверьте почту' : 'Мы отправим ссылку для сброса пароля'}
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Если аккаунт <strong className="text-gray-900 dark:text-gray-100">{sentEmail}</strong> зарегистрирован,
              на него придёт письмо со ссылкой. Ссылка действует ограниченное время.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Не забудьте проверить папку «Спам». После перехода по ссылке задайте новый пароль.
            </p>
            <Link to="/login">
              <Button type="button" variant="secondary" fullWidth>
                Вернуться ко входу
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="example@mail.com"
              icon={<Mail className="w-5 h-5" />}
              error={errors.email?.message}
              {...register('email')}
            />

            <Button type="submit" fullWidth loading={loading} className="mt-2">
              Отправить ссылку
            </Button>

            <Link
              to="/login"
              className="flex items-center justify-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Назад ко входу
            </Link>
          </form>
        )}
      </Card>
    </div>
  )
}

export default ForgotPasswordPage
