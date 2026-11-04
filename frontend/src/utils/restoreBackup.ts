/**
 * Восстановление бэкапа только через RPC.
 * Клиентский путь с предварительным удалением убран: при обрыве вставки данные уже не вернуть.
 */

import { supabase } from '../lib/supabaseClient'
import { BackupData, validateBackup } from './backupFile'

export { MAX_BACKUP_FILE_BYTES, validateBackup, formatBackupPreview } from './backupFile'
export type { BackupData, BackupTableCounts } from './backupFile'

/** Текст ошибки Supabase/PostgREST */
export function formatSupabaseError(error: {
  message?: string
  details?: string
  hint?: string
  code?: string
}): string {
  const parts = [error.message, error.details, error.hint].filter(
    (part) => part && part.trim() && part !== '{}'
  )

  if (parts.length > 0) {
    return parts.join('. ')
  }

  if (error.code === 'PGRST202') {
    return 'Функция restore_user_backup не найдена. Выполните миграцию supabase/migrations/20261104_sprint_a_data_safety.sql. Данные не изменялись.'
  }

  return error.code ? `Ошибка базы данных (${error.code})` : 'Ошибка базы данных'
}

/** Атомарное восстановление. Если функции в базе нет, локальные данные не удаляются */
export async function restoreBackupViaRpc(backup: BackupData): Promise<void> {
  const { error } = await supabase.rpc('restore_user_backup', { p_backup: backup })

  if (error) {
    throw new Error(formatSupabaseError(error))
  }
}

/** Проверяет файл и восстанавливает его одной транзакцией на сервере */
export async function restoreBackupData(data: unknown): Promise<void> {
  const backup = validateBackup(data)
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    throw new Error('Пользователь не авторизован')
  }

  await restoreBackupViaRpc(backup)
}
