import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Contact } from '../../types'
import { supabaseApi, getErrorMessage } from '../../api/supabase'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

const contactSchema = z.object({
  name: z.string().min(1, 'Имя обязательно'),
  phone: z.string().optional(),
  email: z.string().email('Введите корректный email').optional().or(z.literal('')),
  note: z.string().optional(),
  isFavorite: z.boolean().default(false)
})

type ContactFormData = z.infer<typeof contactSchema>

interface ContactFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  contact?: Contact
}

export const ContactForm: React.FC<ContactFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  contact
}) => {
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { isFavorite: false }
  })

  useEffect(() => {
    if (!isOpen) return

    if (contact) {
      reset({
        name: contact.name,
        phone: contact.phone || '',
        email: contact.email || '',
        note: contact.note || '',
        isFavorite: contact.isFavorite || false
      })
    } else {
      reset({
        name: '',
        phone: '',
        email: '',
        note: '',
        isFavorite: false
      })
    }
  }, [isOpen, contact, reset])

  const onSubmit = async (data: ContactFormData) => {
    try {
      setLoading(true)
      const payload = {
        ...data,
        phone: data.phone || undefined,
        email: data.email || undefined
      }

      if (contact) {
        await supabaseApi.contacts.update(contact.id, payload)
        toast.success('Контакт обновлен')
      } else {
        await supabaseApi.contacts.create(payload)
        toast.success('Контакт создан')
      }
      onSuccess()
      onClose()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={contact ? 'Редактировать контакт' : 'Новый контакт'}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Имя *"
          placeholder="Например: Иван Иванов"
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label="Телефон"
          placeholder="+7 700 123 45 67"
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Input
          label="Email"
          type="email"
          placeholder="ivan@example.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Примечание"
          placeholder="Дополнительная информация"
          error={errors.note?.message}
          {...register('note')}
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isFavorite"
            className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
            {...register('isFavorite')}
          />
          <label htmlFor="isFavorite" className="text-sm text-gray-700">
            Добавить в избранное
          </label>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Отмена
          </Button>
          <Button type="submit" loading={loading} className="flex-1">
            {contact ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
