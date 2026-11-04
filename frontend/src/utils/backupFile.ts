/**
 * Проверка и описание JSON-бэкапа.
 * Модуль без обращений к Supabase, чтобы пустой файл отсекался до удаления данных.
 */

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

/** Таблицы, из которых собирается файл бэкапа */
export const BACKUP_TABLES = [
  'accounts',
  'categories',
  'transactions',
  'transfers',
  'scheduled_transactions',
  'contacts',
  'debts',
  'debt_payments'
] as const

export type BackupTableName = (typeof BACKUP_TABLES)[number]

export type BackupTableCounts = Record<BackupTableName, number>

/** Версии, которые умеет писать и читать текущий клиент */
const ALLOWED_BACKUP_VERSIONS = new Set(['1.0', '1.0.0'])

/** Таблицы, без которых файл не считается бэкапом. Одни платежи по долгам базу не заменяют */
const CONTENT_TABLES = [
  'accounts',
  'categories',
  'contacts',
  'debts',
  'transactions',
  'transfers',
  'scheduled_transactions'
] as const

/** Максимальный размер файла бэкапа (15 МБ) */
export const MAX_BACKUP_FILE_BYTES = 15 * 1024 * 1024

/** Максимальное число строк в одной таблице бэкапа */
const MAX_BACKUP_ROWS_PER_TABLE = 50_000

function rowCount(rows: BackupRow[] | undefined): number {
  return rows?.length ?? 0
}

/**
 * Проверяет, что файл — непустой бэкап известной версии.
 * Пустой `{"version":"1.0"}` здесь отклоняется и не доходит до DELETE в базе.
 */
export function validateBackup(data: unknown): BackupData {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Неверный формат файла бэкапа')
  }

  const backup = data as BackupData

  if (typeof backup.version !== 'string' || !ALLOWED_BACKUP_VERSIONS.has(backup.version)) {
    throw new Error('Неверный формат бэкапа: неподдерживаемая version')
  }

  if (typeof backup.exportedAt !== 'string' || backup.exportedAt.trim() === '') {
    throw new Error('Неверный формат бэкапа: нет даты экспорта')
  }

  if (Number.isNaN(Date.parse(backup.exportedAt))) {
    throw new Error('Неверный формат бэкапа: дата экспорта некорректна')
  }

  const tableKeys = [...CONTENT_TABLES, 'debt_payments'] as const

  for (const key of tableKeys) {
    const value = backup[key]

    if (value !== undefined && !Array.isArray(value)) {
      throw new Error(`Неверный формат бэкапа: ${key}`)
    }

    if (Array.isArray(value) && value.length > MAX_BACKUP_ROWS_PER_TABLE) {
      throw new Error(`Слишком много записей в ${key} (максимум ${MAX_BACKUP_ROWS_PER_TABLE})`)
    }
  }

  const contentRows = CONTENT_TABLES.reduce((sum, key) => sum + rowCount(backup[key]), 0)

  if (contentRows === 0) {
    throw new Error('Бэкап не содержит данных')
  }

  return backup
}

/** Текст подтверждения: дата и число записей до замены текущих данных */
export function formatBackupPreview(backup: BackupData): string {
  const lines = [
    `Бэкап от ${backup.exportedAt}.`,
    `Счета: ${rowCount(backup.accounts)}. Операции: ${rowCount(backup.transactions)}. Долги: ${rowCount(backup.debts)}.`,
    `Категории: ${rowCount(backup.categories)}. Контакты: ${rowCount(backup.contacts)}. Переводы: ${rowCount(backup.transfers)}.`,
    `Регулярные: ${rowCount(backup.scheduled_transactions)}. Платежи по долгам: ${rowCount(backup.debt_payments)}.`,
    'Текущие данные будут удалены и заменены этим файлом. Продолжить?'
  ]

  return lines.join('\n')
}

/** Сколько строк ушло в файл — показывается после экспорта */
export function formatBackupExportSummary(counts: BackupTableCounts): string {
  return [
    `счета ${counts.accounts}`,
    `операции ${counts.transactions}`,
    `долги ${counts.debts}`,
    `категории ${counts.categories}`,
    `контакты ${counts.contacts}`,
    `переводы ${counts.transfers}`,
    `регулярные ${counts.scheduled_transactions}`,
    `платежи ${counts.debt_payments}`
  ].join(', ')
}
