import { Debt, DebtPayment } from '../types'

/** Подпись типа операции в истории долга */
export function debtEntryTypeLabel(entryType?: DebtPayment['entryType']): string {
  if (entryType === 'increase') return 'Увеличение'
  if (entryType === 'initial') return 'Первоначальный займ'
  return 'Погашение'
}

/** Сумма первоначального займа (без последующих увеличений) */
export function computeInitialAmount(debt: Debt): number {
  const increases = (debt.payments ?? [])
    .filter((p) => p.entryType === 'increase')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  return Number(debt.amount) - increases
}

/**
 * Все операции долга для отображения в истории.
 * Если записи initial нет (старые данные) — добавляется виртуальная.
 */
export function getDebtHistoryPayments(debt: Debt): DebtPayment[] {
  const payments = [...(debt.payments ?? [])]
  const hasInitial = payments.some((p) => p.entryType === 'initial')

  if (!hasInitial) {
    payments.push({
      id: `virtual-initial-${debt.id}`,
      debtId: debt.id,
      amount: computeInitialAmount(debt),
      date: debt.dateTaken,
      note: debt.purpose,
      entryType: 'initial'
    })
  }

  return payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

/** Можно ли удалить операцию из истории */
export function canDeleteDebtPayment(payment: DebtPayment): boolean {
  return payment.entryType !== 'initial' && !payment.id.startsWith('virtual-')
}

/** Можно ли редактировать операцию */
export function canEditDebtPayment(payment: DebtPayment): boolean {
  return !payment.id.startsWith('virtual-')
}
