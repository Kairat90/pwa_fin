import { z } from 'zod'
import { CURRENCIES, normalizeCurrency } from './currency'

const validCurrencyCodes = CURRENCIES.map((c) => c.code)

export const loginSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Минимум 6 символов')
})

export const registerSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Минимум 6 символов'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword']
})

export const accountSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  currency: z.string()
    .min(1, 'Валюта обязательна')
    .transform(normalizeCurrency)
    .refine((c) => validCurrencyCodes.includes(c as typeof validCurrencyCodes[number]), {
      message: 'Выберите валюту из списка'
    }),
  initialBalance: z.coerce.number().min(0),
  icon: z.string().optional(),
  color: z.string().optional(),
  type: z.string().optional()
})

export const categorySchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  type: z.enum(['income', 'expense']),
  icon: z.string().optional(),
  color: z.string().optional()
})

export const transactionSchema = z.object({
  accountId: z.string().min(1, 'Выберите счет'),
  categoryId: z.string().min(1, 'Выберите категорию'),
  amount: z.coerce.number().positive('Сумма должна быть больше 0'),
  date: z.string().min(1),
  note: z.string().optional()
})
