import { supabase } from '../lib/supabaseClient'
import {
  Account,
  Category,
  Contact,
  Debt,
  DebtPayment,
  DebtEntryMode,
  PaginatedResponse,
  ScheduledTransaction,
  Transaction,
  Transfer,
  User
} from '../types'
import { mapKeys, toSnakeCase } from '../utils/supabaseMappers'
import { normalizeCategory } from '../utils/categoryTree'
import { buildIlikeOrFilter, buildUuidEqOrFilter } from '../utils/postgrestFilter'
import { restoreBackupData, validateBackup } from '../utils/restoreBackup'
import { addDays, endOfDay } from 'date-fns'
import { buildContactHistory, ContactHistoryData, ContactCurrencySummary, ContactPaymentEntry } from '../utils/contactHistory'
import { computeDebtStats, type DebtStats } from '../utils/debtStats'

const AUTH_CODE_MESSAGES: Record<string, string> = {
  signup_disabled: 'Регистрация отключена. Включите Email sign ups в Supabase → Authentication → Providers',
  email_exists: 'Пользователь с таким email уже зарегистрирован',
  user_already_exists: 'Пользователь с таким email уже зарегистрирован',
  weak_password: 'Слишком слабый пароль (минимум 6 символов)',
  unexpected_failure: 'Ошибка базы данных при регистрации. Выполните SQL: migrations/20250103_fix_signup_trigger.sql',
  over_email_send_rate_limit: 'Слишком много попыток. Подождите несколько минут',
  email_address_invalid: 'Некорректный email',
  validation_failed: 'Данные не прошли проверку. Проверьте email и пароль',
  email_not_confirmed: 'Подтвердите email по ссылке из письма, затем войдите',
  user_not_found: 'Пользователь с таким email не найден'
}

/** URL для возврата после ссылки из письма Supabase */
function getAuthRedirectUrl(path: string): string {
  return `${window.location.origin}${path}`
}

/** Форматирует ошибку Supabase Auth */
function formatAuthError(error: { message?: string; code?: string; status?: number }): string {
  if (error.code && AUTH_CODE_MESSAGES[error.code]) {
    return AUTH_CODE_MESSAGES[error.code]
  }

  const msg = error.message?.trim()
  if (msg && msg !== '{}' && msg !== '[object Object]') {
    if (msg.includes('Database error saving new user')) {
      return 'Ошибка создания профиля в БД. Выполните migrations/20250103_fix_signup_trigger.sql в Supabase SQL Editor'
    }
    if (msg.includes('redirect') || msg.includes('Redirect')) {
      return 'URL сайта не добавлен в Supabase → Authentication → URL Configuration → Redirect URLs'
    }
    return msg
  }

  if (error.code) return `Ошибка авторизации: ${error.code}`
  if (error.status) return `Ошибка сервера (${error.status})`
  return 'Ошибка регистрации'
}

/** Сообщение об ошибке для toast */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const authError = error as Error & { code?: string; status?: number }
    return formatAuthError({
      message: authError.message,
      code: authError.code,
      status: authError.status
    })
  }

  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>
    return formatAuthError({
      message: typeof e.message === 'string' ? e.message : undefined,
      code: typeof e.code === 'string' ? e.code : undefined,
      status: typeof e.status === 'number' ? e.status : undefined
    })
  }

  return 'Неизвестная ошибка'
}

// =====================================================
// Типы для отчётов и дашборда
// =====================================================

export interface ReportSummary {
  totalIncome: number
  totalExpense: number
  netFlow: number
  averageDailyExpense: number
  transactionCount: number
  incomeCount: number
  expenseCount: number
  savingsRate: number
}

export interface CategoryBreakdown {
  id: string
  name: string
  icon: string
  color: string
  amount: number
  percentage: number
  count: number
}

export interface BalanceHistory {
  date: string
  balance: number
  day: number
}

export interface TopTransaction {
  id: string
  amount: number
  date: string
  note?: string
  category?: string
  categoryIcon?: string
  account?: string
}

export interface ComparisonReport {
  current: ReportSummary
  previous: ReportSummary
  changes: {
    income: number
    expense: number
    netFlow: number
    transactions: number
  }
}

export interface Forecast {
  currentBalance: number
  dailyExpense: number
  dailyIncome: number
  projectedBalance: number
  daysUntilZero: number
  monthsUntilZero: number
}

export type TransactionFilters = {
  startDate?: string
  endDate?: string
  accountId?: string
  categoryId?: string
  type?: 'income' | 'expense'
  search?: string
  page?: number
  limit?: number
}

export type TransferCreateData = {
  fromAccountId: string
  toAccountId: string
  amount: number
  fee?: number
  date: string
  note?: string
}

export type ScheduledCreateData = Omit<
  ScheduledTransaction,
  'id' | 'isActive' | 'nextExecutionDate' | 'lastExecutedDate' | 'account' | 'category'
> & {
  isActive?: boolean
}

export type ScheduledExecuteData = {
  amount?: number
  date?: string
  note?: string
}

export type DebtCreateData = {
  contactId: string
  accountId?: string
  amount: number
  currency: string
  type: 'iOwe' | 'owedToMe'
  dateTaken: string
  dueDate?: string
  purpose?: string
  interestRate?: number
  isInBudget?: boolean
  reminderDays?: number
}

export type DebtPaymentData = {
  amount: number
  date: string
  note?: string
  createTransaction?: boolean
  accountId?: string
  entryType?: DebtEntryMode
}

export type { DebtStats } from '../utils/debtStats'

export type ContactHistory = {
  contact: Contact
  debts: Debt[]
  summaries: ContactCurrencySummary[]
  payments: ContactPaymentEntry[]
}

// =====================================================
// Утилиты
// =====================================================

async function enrichDebts(raw: Record<string, unknown>[]): Promise<Debt[]> {
  return raw.map((debt) => {
    const payments = (debt.payments as Array<{ amount: number; entryType?: string; entry_type?: string }>) ?? []
    const paidAmount = payments
      .filter((p) => (p.entryType ?? p.entry_type ?? 'repayment') === 'repayment')
      .reduce((s, p) => s + Number(p.amount), 0)
    const amount = Number(debt.amount)
    return {
      ...(debt as unknown as Debt),
      paidAmount,
      remainingAmount: amount - paidAmount
    }
  })
}

// =====================================================
// Единый API Supabase
// =====================================================

export const supabaseApi = {
  auth: {
    signUp: async (email: string, password: string, name?: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: name ? { name } : {}
        }
      })

      if (error) {
        const err = new Error(formatAuthError(error)) as Error & { code?: string }
        err.code = error.code
        throw err
      }

      return data
    },

    signIn: async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const err = new Error(formatAuthError(error)) as Error & { code?: string }
        err.code = error.code
        throw err
      }
      return data
    },

    signOut: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw new Error(error.message)
    },

    getUser: () => supabase.auth.getUser(),

    getSession: () => supabase.auth.getSession(),

    onAuthStateChange: (callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) =>
      supabase.auth.onAuthStateChange(callback),

    mapUser: (userId: string, email: string, metadata?: Record<string, unknown>): User => ({
      id: userId,
      email,
      name: metadata?.name as string | undefined,
      defaultCurrency: (metadata?.default_currency as string) || (metadata?.defaultCurrency as string) || 'KZT',
      createdAt: new Date().toISOString()
    }),

    /** Загрузка профиля из public.users */
    fetchProfile: async (): Promise<User | null> => {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (authError) throw new Error(formatAuthError(authError))
      if (!authUser) return null

      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, default_currency, created_at')
        .eq('id', authUser.id)
        .maybeSingle()

      if (error) throw new Error(error.message)

      if (!data) {
        return {
          id: authUser.id,
          email: authUser.email ?? '',
          name: authUser.user_metadata?.name as string | undefined,
          defaultCurrency: 'KZT',
          createdAt: new Date().toISOString()
        }
      }

      const row = mapKeys<{
        id: string
        email: string
        name?: string
        defaultCurrency?: string
        createdAt: string
      }>(data)

      return {
        id: row.id,
        email: row.email,
        name: row.name,
        defaultCurrency: row.defaultCurrency || 'KZT',
        createdAt: row.createdAt
      }
    },

    updateProfile: async (payload: { name?: string; defaultCurrency?: string }): Promise<User> => {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (authError) throw new Error(formatAuthError(authError))
      if (!authUser) throw new Error('Пользователь не авторизован')

      const dbUpdate: Record<string, string> = {}
      if (payload.name !== undefined) dbUpdate.name = payload.name
      if (payload.defaultCurrency !== undefined) dbUpdate.default_currency = payload.defaultCurrency

      if (Object.keys(dbUpdate).length > 0) {
        const { error } = await supabase
          .from('users')
          .update(dbUpdate)
          .eq('id', authUser.id)

        if (error) throw new Error(error.message)
      }

      if (payload.name !== undefined) {
        const { error: metaError } = await supabase.auth.updateUser({
          data: { name: payload.name }
        })
        if (metaError) throw new Error(formatAuthError(metaError))
      }

      const profile = await supabaseApi.auth.fetchProfile()
      if (!profile) throw new Error('Не удалось загрузить профиль')
      return profile
    },

    changePassword: async (newPassword: string): Promise<void> => {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw new Error(formatAuthError(error))
    },

    /** Отправка письма со ссылкой для сброса пароля */
    requestPasswordReset: async (email: string): Promise<void> => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl('/reset-password')
      })
      if (error) throw new Error(formatAuthError(error))
    },

    deleteAccount: async (): Promise<void> => {
      const { error } = await supabase.rpc('delete_own_account')
      if (error) throw new Error(error.message)
      await supabase.auth.signOut()
    },

    /** Создаёт профиль и категории, если триггер БД не сработал */
    ensureProfile: async (): Promise<void> => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw new Error(formatAuthError(userError))
      if (!user) return

      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (!existing) {
        const { error: insertError } = await supabase.from('users').insert({
          id: user.id,
          email: user.email ?? '',
          name: (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'User'
        })

        if (insertError && insertError.code !== '23505') {
          throw new Error(insertError.message)
        }
      }

      const { error: catError } = await supabase.rpc('init_system_categories')
      if (catError) {
        throw new Error(catError.message)
      }
    }
  },

  accounts: {
    getAll: async (includeArchived = false): Promise<Account[]> => {
      let query = supabase.from('accounts').select('*').order('created_at', { ascending: false })
      if (!includeArchived) query = query.eq('is_archived', false)

      const { data, error } = await query
      if (error) throw new Error(error.message)

      const accounts = mapKeys<Account[]>(data ?? [])
      return Promise.all(
        accounts.map(async (acc) => {
          const { data: balance, error: balanceError } = await supabase.rpc('get_account_balance', {
            p_account_id: acc.id
          })
          if (balanceError) throw new Error(balanceError.message)
          return { ...acc, balance: Number(balance ?? 0) }
        })
      )
    },

    getOne: async (id: string): Promise<Account> => {
      const { data, error } = await supabase.from('accounts').select('*').eq('id', id).single()
      if (error) throw new Error(error.message)
      const account = mapKeys<Account>(data)
      const { data: balance, error: balanceError } = await supabase.rpc('get_account_balance', {
        p_account_id: id
      })
      if (balanceError) throw new Error(balanceError.message)
      return { ...account, balance: Number(balance ?? 0) }
    },

    create: async (payload: Partial<Account>): Promise<Account> => {
      const { data, error } = await supabase
        .from('accounts')
        .insert(toSnakeCase(payload as Record<string, unknown>))
        .select()
        .single()
      if (error) throw new Error(error.message)
      return mapKeys<Account>(data)
    },

    update: async (id: string, payload: Partial<Account>): Promise<Account> => {
      const { data, error } = await supabase
        .from('accounts')
        .update(toSnakeCase(payload as Record<string, unknown>))
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return mapKeys<Account>(data)
    },

    archive: async (id: string): Promise<void> => {
      const { error } = await supabase.from('accounts').update({ is_archived: true }).eq('id', id)
      if (error) throw new Error(error.message)
    },

    unarchive: async (id: string): Promise<void> => {
      const { error } = await supabase.from('accounts').update({ is_archived: false }).eq('id', id)
      if (error) throw new Error(error.message)
    },

    getTotalBalance: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('get_total_balance')
      if (error) throw new Error(error.message)
      return Number(data ?? 0)
    }
  },

  categories: {
    getAll: async (type?: 'income' | 'expense'): Promise<Category[]> => {
      let query = supabase
        .from('categories')
        .select('*, parent:parent_id(id, name, icon, color)')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      if (type) query = query.eq('type', type)
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return (mapKeys<Category[]>(data ?? [])).map(normalizeCategory)
    },

    getOne: async (id: string): Promise<Category> => {
      const { data, error } = await supabase.from('categories').select('*').eq('id', id).single()
      if (error) throw new Error(error.message)
      return mapKeys<Category>(data)
    },

    create: async (payload: Partial<Category>): Promise<Category> => {
      const { data, error } = await supabase
        .from('categories')
        .insert(toSnakeCase(payload as Record<string, unknown>))
        .select()
        .single()
      if (error) throw new Error(error.message)
      return mapKeys<Category>(data)
    },

    update: async (id: string, payload: Partial<Category>): Promise<Category> => {
      const { data, error } = await supabase
        .from('categories')
        .update(toSnakeCase(payload as Record<string, unknown>))
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return mapKeys<Category>(data)
    },

    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },

    init: async (): Promise<void> => {
      const { error } = await supabase.rpc('init_system_categories')
      if (error) throw new Error(error.message)
    },

    reorder: async (id: string, direction: 'up' | 'down'): Promise<void> => {
      const { error } = await supabase.rpc('reorder_category', {
        p_category_id: id,
        p_direction: direction
      })
      if (error) throw new Error(error.message)
    }
  },

  transactions: {
    getAll: async (filters?: TransactionFilters): Promise<PaginatedResponse<Transaction>> => {
      let query = supabase
        .from('transactions')
        .select('*, account:accounts(*), category:categories(*)', { count: 'exact' })
        .order('date', { ascending: false })

      if (filters?.startDate) query = query.gte('date', filters.startDate)
      if (filters?.endDate) query = query.lte('date', filters.endDate)
      if (filters?.accountId) query = query.eq('account_id', filters.accountId)
      if (filters?.categoryId) query = query.eq('category_id', filters.categoryId)
      if (filters?.type === 'income') query = query.gt('amount', 0)
      if (filters?.type === 'expense') query = query.lt('amount', 0)

      const page = filters?.page ?? 1
      const limit = filters?.limit ?? 50

      // Поиск по примечанию и тегам — фильтрация на клиенте (теги — массив, ilike в PostgREST неудобен)
      if (filters?.search?.trim()) {
        const term = filters.search.trim().toLowerCase()
        const { data, error } = await query.limit(2000)

        if (error) throw new Error(error.message)

        const matched = mapKeys<Transaction[]>(data ?? []).filter(
          (t) =>
            (t.note?.toLowerCase().includes(term) ?? false) ||
            t.tags.some((tag) => tag.toLowerCase().includes(term))
        )

        const total = matched.length
        const from = (page - 1) * limit

        return {
          data: matched.slice(from, from + limit),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1
        }
      }

      const from = (page - 1) * limit
      const to = from + limit - 1

      const { data, error, count } = await query.range(from, to)
      if (error) throw new Error(error.message)

      const total = count ?? data?.length ?? 0
      return {
        data: mapKeys<Transaction[]>(data ?? []),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    },

    /** Все транзакции за период (для отчётов с фильтром по счетам) */
    getAllInRange: async (startDate: string, endDate: string, accountIds?: string[]): Promise<Transaction[]> => {
      let query = supabase
        .from('transactions')
        .select('*, account:accounts(*), category:categories(*)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .limit(5000)

      if (accountIds && accountIds.length > 0) {
        query = query.in('account_id', accountIds)
      }

      const { data, error } = await query
      if (error) throw new Error(error.message)

      return mapKeys<Transaction[]>(data ?? [])
    },

    getOne: async (id: string): Promise<Transaction> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, account:accounts(*), category:categories(*)')
        .eq('id', id)
        .single()
      if (error) throw new Error(error.message)
      return mapKeys<Transaction>(data)
    },

    createIncome: async (payload: Record<string, unknown>): Promise<Transaction> => {
      const amount = Math.abs(Number(payload.amount))
      const { data, error } = await supabase
        .from('transactions')
        .insert(toSnakeCase({ ...payload, amount }))
        .select('*, account:accounts(*), category:categories(*)')
        .single()
      if (error) throw new Error(error.message)
      return mapKeys<Transaction>(data)
    },

    createExpense: async (payload: Record<string, unknown>): Promise<Transaction> => {
      const amount = -Math.abs(Number(payload.amount))
      const { data, error } = await supabase
        .from('transactions')
        .insert(toSnakeCase({ ...payload, amount }))
        .select('*, account:accounts(*), category:categories(*)')
        .single()
      if (error) throw new Error(error.message)
      return mapKeys<Transaction>(data)
    },

    update: async (id: string, payload: Record<string, unknown>): Promise<Transaction> => {
      const { data, error } = await supabase
        .from('transactions')
        .update(toSnakeCase(payload))
        .eq('id', id)
        .select('*, account:accounts(*), category:categories(*)')
        .single()
      if (error) throw new Error(error.message)
      return mapKeys<Transaction>(data)
    },

    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },

    deleteMany: async (ids: string[]): Promise<void> => {
      await Promise.all(ids.map((id) => supabaseApi.transactions.delete(id)))
    }
  },

  transfers: {
    getAll: async (filters?: {
      startDate?: string
      endDate?: string
      accountId?: string
      page?: number
      limit?: number
    }): Promise<PaginatedResponse<Transfer>> => {
      let query = supabase
        .from('transfers')
        .select(`
          *,
          from_account:accounts!transfers_from_account_id_fkey(*),
          to_account:accounts!transfers_to_account_id_fkey(*)
        `)
        .order('date', { ascending: false })

      if (filters?.startDate) query = query.gte('date', filters.startDate)
      if (filters?.endDate) query = query.lte('date', filters.endDate)
      if (filters?.accountId) {
        query = query.or(buildUuidEqOrFilter('from_account_id', 'to_account_id', filters.accountId))
      }

      const { data, error } = await query
      if (error) throw new Error(error.message)

      const page = filters?.page ?? 1
      const limit = filters?.limit ?? 20
      const all = mapKeys<Transfer[]>(data ?? [])
      const start = (page - 1) * limit

      return {
        data: all.slice(start, start + limit),
        total: all.length,
        page,
        limit,
        totalPages: Math.ceil(all.length / limit) || 1
      }
    },

    create: async (payload: TransferCreateData): Promise<Transfer> => {
      const { data, error } = await supabase.rpc('create_transfer', toSnakeCase(payload as Record<string, unknown>))
      if (error) throw new Error(error.message)
      return mapKeys<Transfer>(data)
    },

    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('transfers').delete().eq('id', id)
      if (error) throw new Error(error.message)
    }
  },

  scheduled: {
    getAll: async (filters?: {
      isActive?: boolean
      type?: 'income' | 'expense'
      accountId?: string
    }): Promise<ScheduledTransaction[]> => {
      let query = supabase
        .from('scheduled_transactions')
        .select('*, account:accounts(*), category:categories(*)')
        .order('next_execution_date', { ascending: true })

      if (filters?.isActive !== undefined) query = query.eq('is_active', filters.isActive)
      if (filters?.type) query = query.eq('type', filters.type)
      if (filters?.accountId) query = query.eq('account_id', filters.accountId)

      const { data, error } = await query
      if (error) throw new Error(error.message)
      return mapKeys<ScheduledTransaction[]>(data ?? [])
    },

    /** Активные операции с датой выполнения в ближайшие N дней (включая просроченные) */
    getUpcoming: async (daysAhead = 7): Promise<ScheduledTransaction[]> => {
      const until = endOfDay(addDays(new Date(), daysAhead)).toISOString()

      const { data, error } = await supabase
        .from('scheduled_transactions')
        .select('*, account:accounts(*), category:categories(*)')
        .eq('is_active', true)
        .lte('next_execution_date', until)
        .order('next_execution_date', { ascending: true })
        .limit(20)

      if (error) throw new Error(error.message)
      return mapKeys<ScheduledTransaction[]>(data ?? [])
    },

    getOne: async (id: string): Promise<ScheduledTransaction> => {
      const { data, error } = await supabase
        .from('scheduled_transactions')
        .select('*, account:accounts(*), category:categories(*)')
        .eq('id', id)
        .single()
      if (error) throw new Error(error.message)
      return mapKeys<ScheduledTransaction>(data)
    },

    create: async (payload: ScheduledCreateData): Promise<ScheduledTransaction> => {
      const snake = toSnakeCase(payload as Record<string, unknown>)
      if (!snake.next_execution_date) {
        snake.next_execution_date = snake.start_date
      }
      const { data, error } = await supabase
        .from('scheduled_transactions')
        .insert(snake)
        .select('*, account:accounts(*), category:categories(*)')
        .single()
      if (error) throw new Error(error.message)
      return mapKeys<ScheduledTransaction>(data)
    },

    update: async (id: string, payload: Partial<ScheduledTransaction>): Promise<ScheduledTransaction> => {
      const { data, error } = await supabase
        .from('scheduled_transactions')
        .update(toSnakeCase(payload as Record<string, unknown>))
        .eq('id', id)
        .select('*, account:accounts(*), category:categories(*)')
        .single()
      if (error) throw new Error(error.message)
      return mapKeys<ScheduledTransaction>(data)
    },

    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('scheduled_transactions').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },

    skip: async (id: string): Promise<ScheduledTransaction> => {
      const { data, error } = await supabase.rpc('skip_scheduled_execution', { scheduled_id: id })
      if (error) throw new Error(error.message)
      return mapKeys<ScheduledTransaction>(data)
    },

    execute: async (id: string, overrides?: ScheduledExecuteData): Promise<unknown> => {
      const { data, error } = await supabase.rpc('execute_scheduled_now', {
        scheduled_id: id,
        override_amount: overrides?.amount ?? null,
        override_date: overrides?.date ?? null,
        override_note: overrides?.note ?? null
      })
      if (error) throw new Error(error.message)
      return mapKeys(data)
    },

    process: async (): Promise<unknown[]> => {
      const { data, error } = await supabase.rpc('process_scheduled_transactions')
      if (error) throw new Error(error.message)
      return mapKeys<unknown[]>(data ?? [])
    }
  },

  contacts: {
    getAll: async (filters?: { search?: string; isFavorite?: boolean }): Promise<Contact[]> => {
      let query = supabase
        .from('contacts')
        .select('*, debts:debts(*)')
        .order('is_favorite', { ascending: false })
        .order('name', { ascending: true })

      if (filters?.search) {
        const orFilter = buildIlikeOrFilter(['name', 'phone', 'email'], filters.search)

        if (orFilter) {
          query = query.or(orFilter)
        }
      }
      if (filters?.isFavorite !== undefined) {
        query = query.eq('is_favorite', filters.isFavorite)
      }

      const { data, error } = await query
      if (error) throw new Error(error.message)
      return mapKeys<Contact[]>(data ?? [])
    },

    getOne: async (id: string): Promise<Contact> => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*, debts:debts(*, payments:debt_payments(*))')
        .eq('id', id)
        .single()
      if (error) throw new Error(error.message)
      const contact = mapKeys<Contact>(data)
      const rawDebts = (data as { debts?: Record<string, unknown>[] }).debts ?? []
      const debts = await enrichDebts(mapKeys<Record<string, unknown>[]>(rawDebts))
      return { ...contact, debts }
    },

    /** История контакта: долги, платежи, итоги по валютам */
    getHistory: async (id: string): Promise<ContactHistory> => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*, debts:debts(*, payments:debt_payments(*))')
        .eq('id', id)
        .single()

      if (error) throw new Error(error.message)

      const contact = mapKeys<Contact>(data)
      const rawDebts = (data as { debts?: Record<string, unknown>[] }).debts ?? []
      const debts = await enrichDebts(mapKeys<Record<string, unknown>[]>(rawDebts))
      const history: ContactHistoryData = buildContactHistory(debts)

      return {
        contact: { ...contact, debts: history.debts },
        debts: history.debts,
        summaries: history.summaries,
        payments: history.payments
      }
    },

    create: async (payload: Partial<Contact>): Promise<Contact> => {
      const { data, error } = await supabase
        .from('contacts')
        .insert(toSnakeCase(payload as Record<string, unknown>))
        .select()
        .single()
      if (error) throw new Error(error.message)
      return mapKeys<Contact>(data)
    },

    update: async (id: string, payload: Partial<Contact>): Promise<Contact> => {
      const { data, error } = await supabase
        .from('contacts')
        .update(toSnakeCase(payload as Record<string, unknown>))
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return mapKeys<Contact>(data)
    },

    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('contacts').delete().eq('id', id)
      if (error) throw new Error(error.message)
    }
  },

  debts: {
    getAll: async (filters?: {
      contactId?: string
      type?: 'iOwe' | 'owedToMe'
      status?: 'active' | 'overdue' | 'settled' | 'writtenOff'
      isInBudget?: boolean
    }): Promise<Debt[]> => {
      let query = supabase
        .from('debts')
        .select('*, contact:contacts(*), account:accounts(*), payments:debt_payments(*)')
        .order('due_date', { ascending: true })

      if (filters?.contactId) query = query.eq('contact_id', filters.contactId)
      if (filters?.type) query = query.eq('type', filters.type)
      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.isInBudget !== undefined) query = query.eq('is_in_budget', filters.isInBudget)

      const { data, error } = await query
      if (error) throw new Error(error.message)
      return enrichDebts(mapKeys<Record<string, unknown>[]>(data ?? []))
    },

    getOne: async (id: string): Promise<Debt> => {
      const { data, error } = await supabase
        .from('debts')
        .select('*, contact:contacts(*), account:accounts(*), payments:debt_payments(*)')
        .eq('id', id)
        .single()
      if (error) throw new Error(error.message)

      const [debt] = await enrichDebts([mapKeys<Record<string, unknown>>(data)])
      return {
        ...debt,
        isFullyPaid: (debt.remainingAmount ?? 0) <= 0
      } as Debt & { isFullyPaid?: boolean }
    },

    create: async (payload: DebtCreateData): Promise<Debt> => {
      const { data, error } = await supabase.rpc('create_debt', toSnakeCase(payload as Record<string, unknown>))
      if (error) throw new Error(error.message)
      return mapKeys<Debt>(data)
    },

    update: async (id: string, payload: Partial<Debt>): Promise<Debt> => {
      const { data, error } = await supabase
        .from('debts')
        .update(toSnakeCase(payload as Record<string, unknown>))
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return mapKeys<Debt>(data)
    },

    addPayment: async (
      debtId: string,
      payload: DebtPaymentData
    ): Promise<{ payment: DebtPayment; remainingAmount: number; isFullyPaid: boolean }> => {
      const { data, error } = await supabase.rpc('add_debt_payment', {
        debt_id: debtId,
        amount: payload.amount,
        date: payload.date,
        note: payload.note ?? null,
        create_transaction: payload.createTransaction ?? true,
        payment_account_id: payload.accountId ?? null,
        entry_type: payload.entryType ?? 'repayment'
      })
      if (error) throw new Error(error.message)
      return mapKeys(data)
    },

    updatePayment: async (
      paymentId: string,
      payload: Pick<DebtPaymentData, 'amount' | 'date' | 'note' | 'accountId'>
    ): Promise<{ payment: DebtPayment }> => {
      const { data, error } = await supabase.rpc('update_debt_payment', {
        payment_id: paymentId,
        amount: payload.amount,
        date: payload.date,
        note: payload.note ?? null,
        payment_account_id: payload.accountId ?? null
      })
      if (error) throw new Error(error.message)
      return mapKeys(data)
    },

    deletePayment: async (paymentId: string): Promise<{ debtId: string }> => {
      const { data, error } = await supabase.rpc('delete_debt_payment', { payment_id: paymentId })
      if (error) throw new Error(error.message)
      return mapKeys(data)
    },

    writeOff: async (id: string): Promise<void> => {
      const { error } = await supabase.from('debts').update({ status: 'writtenOff' }).eq('id', id)
      if (error) throw new Error(error.message)
    },

    getStats: async (): Promise<DebtStats> => {
      const { data, error } = await supabase
        .from('debts')
        .select('*, payments:debt_payments(*)')
        .in('status', ['active', 'overdue'])

      if (error) throw new Error(error.message)

      return computeDebtStats(await enrichDebts(mapKeys<Record<string, unknown>[]>(data ?? [])))
    },

    checkOverdue: async (): Promise<{ message: string; count: number }> => {
      const { data, error } = await supabase.rpc('check_overdue_debts')
      if (error) throw new Error(error.message)
      return mapKeys(data)
    }
  },

  reports: {
    getSummary: async (startDate: string, endDate: string): Promise<ReportSummary> => {
      const { data, error } = await supabase.rpc('get_summary', {
        start_date: startDate,
        end_date: endDate
      })
      if (error) throw new Error(error.message)
      return mapKeys<ReportSummary>(data)
    },

    getCategoryBreakdown: async (
      startDate: string,
      endDate: string,
      type: 'income' | 'expense'
    ): Promise<CategoryBreakdown[]> => {
      const { data, error } = await supabase.rpc('get_category_breakdown', {
        start_date: startDate,
        end_date: endDate,
        type_param: type
      })
      if (error) throw new Error(error.message)
      return mapKeys<CategoryBreakdown[]>(data ?? [])
    },

    getBalanceHistory: async (startDate: string, endDate: string, accountId?: string): Promise<BalanceHistory[]> => {
      const { data, error } = await supabase.rpc('get_balance_history', {
        start_date: startDate,
        end_date: endDate,
        account_id_param: accountId ?? null
      })
      if (error) throw new Error(error.message)
      return mapKeys<BalanceHistory[]>(data ?? [])
    },

    getTopTransactions: async (startDate: string, endDate: string, limit = 10): Promise<TopTransaction[]> => {
      const { data, error } = await supabase.rpc('get_top_transactions', {
        start_date: startDate,
        end_date: endDate,
        limit_param: limit
      })
      if (error) throw new Error(error.message)
      return mapKeys<TopTransaction[]>(data ?? [])
    },

    getComparison: async (startDate: string, endDate: string): Promise<ComparisonReport> => {
      const { data, error } = await supabase.rpc('get_comparison', {
        start_date: startDate,
        end_date: endDate
      })
      if (error) throw new Error(error.message)
      return mapKeys<ComparisonReport>(data)
    },

    getForecast: async (days = 30): Promise<Forecast> => {
      const { data, error } = await supabase.rpc('get_forecast', { days_ahead: days })
      if (error) throw new Error(error.message)
      return mapKeys<Forecast>(data)
    },

    createBackup: async (): Promise<string> => {
      const tables = [
        'accounts',
        'categories',
        'transactions',
        'transfers',
        'scheduled_transactions',
        'contacts',
        'debts',
        'debt_payments'
      ] as const

      const backup: Record<string, unknown> = {
        version: '1.0.0',
        exportedAt: new Date().toISOString()
      }

      for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*')
        if (error) throw new Error(error.message)
        backup[table] = data
      }

      return JSON.stringify(backup, null, 2)
    },

    exportExcel: async (_startDate: string, _endDate: string): Promise<void> => {
      throw new Error('Экспорт Excel временно недоступен. Используйте JSON-бэкап.')
    },

    exportPDF: async (_startDate: string, _endDate: string): Promise<void> => {
      throw new Error('Экспорт PDF временно недоступен.')
    },

    restoreBackup: async (data: unknown): Promise<void> => {
      validateBackup(data)
      await restoreBackupData(data)
    }
  }
}
