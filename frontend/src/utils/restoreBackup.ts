import { supabase } from '../lib/supabaseClient'

type BackupRow = Record<string, unknown>

export interface BackupData {
  version: string
  exportedAt?: string
  accounts?: BackupRow[]
  categories?: BackupRow[]
  contacts?: BackupRow[]
  debts?: BackupRow[]
  transactions?: BackupRow[]
  transfers?: BackupRow[]
  scheduled_transactions?: BackupRow[]
  debt_payments?: BackupRow[]
}

const USER_TABLES = [
  'accounts',
  'categories',
  'contacts',
  'debts',
  'transactions',
  'transfers',
  'scheduled_transactions'
] as const

const VALID_ACCOUNT_TYPES = new Set(['cash', 'card', 'investment', 'savings'])

const INSERT_CHUNK = 150

/** Проверка формата файла бэкапа */
export function validateBackup(data: unknown): BackupData {
  if (!data || typeof data !== 'object') {
    throw new Error('Неверный формат файла бэкапа')
  }

  const backup = data as BackupData

  if (!backup.version) {
    throw new Error('Неверный формат бэкапа: отсутствует version')
  }

  const tableKeys = [...USER_TABLES, 'debt_payments'] as const

  for (const key of tableKeys) {
    const value = backup[key]
    if (value !== undefined && !Array.isArray(value)) {
      throw new Error(`Неверный формат бэкапа: ${key}`)
    }
  }

  return backup
}

/** Текст ошибки Supabase/PostgREST */
export function formatSupabaseError(error: {
  message?: string
  details?: string
  hint?: string
  code?: string
}): string {
  const parts = [error.message, error.details, error.hint].filter(
    (p) => p && p.trim() && p !== '{}'
  )

  if (parts.length > 0) {
    return parts.join('. ')
  }

  if (error.code === 'PGRST202') {
    return 'Функция restore_user_backup не найдена. Выполните SQL migrations/20250108_restore_user_backup.sql в Supabase'
  }

  return error.code ? `Ошибка базы данных (${error.code})` : 'Ошибка базы данных'
}

function sanitizeContact(row: BackupRow): BackupRow {
  const avatar = row.avatar_data
  if (
    typeof avatar === 'string' &&
    avatar.length >= 2 &&
    avatar[0] === '\\' &&
    (avatar[1] === 'x' || avatar[1] === 'X')
  ) {
    return row
  }
  const { avatar_data: _, ...rest } = row
  return rest
}

function sanitizeAccount(row: BackupRow): BackupRow {
  const type = row.type
  if (typeof type === 'string' && type && !VALID_ACCOUNT_TYPES.has(type)) {
    return { ...row, type: null }
  }
  return row
}

function withUserId(row: BackupRow, userId: string): BackupRow {
  return { ...row, user_id: userId }
}

async function insertChunked(table: string, rows: BackupRow[]): Promise<void> {
  if (rows.length === 0) return

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK)
    const { error } = await supabase.from(table).insert(chunk)

    if (error) {
      throw new Error(`${table}: ${formatSupabaseError(error)}`)
    }
  }
}

/** Удалить все данные текущего пользователя (через RLS) */
async function clearUserData(): Promise<void> {
  const { data: debts, error: debtsReadError } = await supabase.from('debts').select('id')

  if (debtsReadError) {
    throw new Error(`Чтение долгов: ${formatSupabaseError(debtsReadError)}`)
  }

  const debtIds = (debts ?? []).map((d) => d.id as string)

  if (debtIds.length > 0) {
    const { error } = await supabase.from('debt_payments').delete().in('debt_id', debtIds)
    if (error) {
      throw new Error(`Удаление платежей: ${formatSupabaseError(error)}`)
    }
  }

  const deleteTables = [
    'debts',
    'scheduled_transactions',
    'transfers',
    'transactions',
    'categories',
    'contacts',
    'accounts'
  ] as const

  for (const table of deleteTables) {
    const { error } = await supabase.from(table).delete().not('id', 'is', null)

    if (error) {
      throw new Error(`Удаление ${table}: ${formatSupabaseError(error)}`)
    }
  }
}

/** Вставка категорий с иерархией parent_id */
async function insertCategories(rows: BackupRow[], userId: string): Promise<void> {
  if (rows.length === 0) return

  const parents = new Map<string, string | null>()

  const toInsert = rows.map((row) => {
    const id = String(row.id)
    const parentId = row.parent_id ? String(row.parent_id) : null
    parents.set(id, parentId)

    return withUserId({ ...row, parent_id: null }, userId)
  })

  await insertChunked('categories', toInsert)

  for (const [id, parentId] of parents) {
    if (!parentId) continue

    const { error } = await supabase
      .from('categories')
      .update({ parent_id: parentId })
      .eq('id', id)

    if (error) {
      throw new Error(`Категории (связь parent): ${formatSupabaseError(error)}`)
    }
  }
}

/** Восстановление через RPC (атомарно, если функция есть в Supabase) */
export async function restoreBackupViaRpc(backup: BackupData): Promise<void> {
  const { error } = await supabase.rpc('restore_user_backup', { p_backup: backup })

  if (error) {
    throw new Error(formatSupabaseError(error))
  }
}

/** Восстановление через клиент (пакетами, без RPC) */
export async function restoreBackupViaClient(backup: BackupData, userId: string): Promise<void> {
  await clearUserData()

  const accounts = (backup.accounts ?? []).map(sanitizeAccount).map((r) => withUserId(r, userId))
  await insertChunked('accounts', accounts)

  await insertCategories(backup.categories ?? [], userId)

  const contacts = (backup.contacts ?? []).map(sanitizeContact).map((r) => withUserId(r, userId))
  await insertChunked('contacts', contacts)

  const debts = (backup.debts ?? []).map((r) => withUserId(r, userId))
  await insertChunked('debts', debts)

  const transactions = (backup.transactions ?? []).map((r) => withUserId(r, userId))
  await insertChunked('transactions', transactions)

  const transfers = (backup.transfers ?? []).map((r) => withUserId(r, userId))
  await insertChunked('transfers', transfers)

  const scheduled = (backup.scheduled_transactions ?? []).map((r) => withUserId(r, userId))
  await insertChunked('scheduled_transactions', scheduled)

  await insertChunked('debt_payments', backup.debt_payments ?? [])
}

/** Сначала RPC, при ошибке — клиентское восстановление */
export async function restoreBackupData(data: unknown): Promise<void> {
  const backup = validateBackup(data)

  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    throw new Error('Пользователь не авторизован')
  }

  const userId = authData.user.id

  try {
    await restoreBackupViaRpc(backup)
    return
  } catch {
    // RPC недоступен или вернул ошибку — восстановление через API
  }

  await restoreBackupViaClient(backup, userId)
}
