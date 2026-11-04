import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatBackupExportSummary, formatBackupPreview, validateBackup, type BackupTableCounts } from './backupFile'

const exportedAt = '2026-11-04T10:00:00.000Z'

function withAccount(extra: Record<string, unknown> = {}) {
  return {
    version: '1.0.0',
    exportedAt,
    accounts: [{ id: 'acc-1', name: 'Наличные' }],
    ...extra
  }
}

describe('validateBackup', () => {
  it('отклоняет пустой объект и файл только с version', () => {
    assert.throws(() => validateBackup(null), /Неверный формат файла бэкапа/)
    assert.throws(() => validateBackup({ version: '1.0' }), /нет даты экспорта/)
    assert.throws(() => validateBackup({ version: '1.0', exportedAt }), /не содержит данных/)
    assert.throws(() => validateBackup({ version: '9', exportedAt, accounts: [{}] }), /неподдерживаемая version/)
  })

  it('принимает версию 1.0 и 1.0.0, если есть хотя бы одна запись', () => {
    assert.equal(validateBackup(withAccount()).version, '1.0.0')
    assert.equal(validateBackup({ ...withAccount(), version: '1.0' }).accounts?.length, 1)
  })

  it('не считает платежи по долгам самостоятельным бэкапом', () => {
    assert.throws(
      () => validateBackup({ version: '1.0.0', exportedAt, debt_payments: [{ id: 'p1' }] }),
      /не содержит данных/
    )
  })

  it('отклоняет не-массив и битую дату', () => {
    assert.throws(() => validateBackup(withAccount({ categories: {} })), /categories/)
    assert.throws(() => validateBackup(withAccount({ exportedAt: 'не дата' })), /дата экспорта/)
  })
})

describe('formatBackupPreview', () => {
  it('показывает дату и количества до подтверждения', () => {
    const text = formatBackupPreview(validateBackup(withAccount({
      transactions: [{ id: 't1' }, { id: 't2' }],
      debts: [{ id: 'd1' }]
    })))

    assert.match(text, /2026-11-04T10:00:00.000Z/)
    assert.match(text, /Счета: 1/)
    assert.match(text, /Операции: 2/)
    assert.match(text, /Долги: 1/)
    assert.match(text, /Продолжить/)
  })
})

describe('formatBackupExportSummary', () => {
  it('перечисляет выгруженные строки', () => {
    const counts: BackupTableCounts = {
      accounts: 2,
      categories: 3,
      transactions: 10,
      transfers: 0,
      scheduled_transactions: 1,
      contacts: 4,
      debts: 5,
      debt_payments: 6
    }

    const text = formatBackupExportSummary(counts)

    assert.match(text, /счета 2/)
    assert.match(text, /операции 10/)
    assert.match(text, /долги 5/)
  })
})
