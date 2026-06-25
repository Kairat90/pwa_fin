import { supabase } from '../lib/supabaseClient'
import {
  Account,
  Category,
  Contact,
  Debt,
  DebtPayment,
  PaginatedResponse,
  ScheduledTransaction,
  Transaction,
  Transfer,
  User
} from '../types'
import { mapKeys, toSnakeCase } from '../utils/supabaseMappers'

/** Сообщение об ошибке для toast */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: string }).message)
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
}

export type DebtStats = {
  totalIOwe: number
  totalOwedToMe: number
  netPosition: number
  overdueCount: number
  activeCount: number
  totalDebts: number
}

// =====================================================
// Утилиты
// =====================================================

async function enrichDebts(raw: Record<string, unknown>[]): Promise<Debt[]> {
  return raw.map((debt) => {
    const payments = (debt.payments as Array<{ amount: number }>) ?? []
    const paidAmount = payments.reduce((s, p) => s + Number(p.amount), 0)
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
        options: { data: { name } }
      })
      if (error) throw new Error(error.message)
      return data
    },

    signIn: async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
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
      createdAt: new Date().toISOString()
    })
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
      let query = supabase.from('categories').select('*').order('name', { ascending: true })
      if (type) query = query.eq('type', type)
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return mapKeys<Category[]>(data ?? [])
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
        query = query.or(`from_account_id.eq.${filters.accountId},to_account_id.eq.${filters.accountId}`)
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

    execute: async (id: string): Promise<unknown> => {
      const { data, error } = await supabase.rpc('execute_scheduled_now', { scheduled_id: id })
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
        const s = filters.search
        query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`)
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
      return mapKeys<Contact>(data)
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
        ...toSnakeCase(payload as Record<string, unknown>)
      })
      if (error) throw new Error(error.message)
      return mapKeys(data)
    },

    writeOff: async (id: string): Promise<void> => {
      const { error } = await supabase.from('debts').update({ status: 'writtenOff' }).eq('id', id)
      if (error) throw new Error(error.message)
    },

    getStats: async (): Promise<DebtStats> => {
      const { data, error } = await supabase.rpc('get_debt_stats')
      if (error) throw new Error(error.message)
      return mapKeys<DebtStats>(data)
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

    restoreBackup: async (_data: unknown): Promise<void> => {
      throw new Error('Восстановление из бэкапа пока не реализовано.')
    }
  }
}
