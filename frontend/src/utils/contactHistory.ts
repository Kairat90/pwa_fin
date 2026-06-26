import { Debt, DebtPayment } from '../types'
import { normalizeCurrency } from './currency'

/** Сводка по валютам для контакта */
export type ContactCurrencySummary = {
  currency: string
  totalIOwe: number
  totalOwedToMe: number
  netPosition: number
}

/** Платёж в общей истории контакта */
export type ContactPaymentEntry = DebtPayment & {
  debtId: string
  debtType: Debt['type']
  debtPurpose?: string
  currency: string
}

export type ContactHistoryData = {
  debts: Debt[]
  summaries: ContactCurrencySummary[]
  payments: ContactPaymentEntry[]
}

function debtRemaining(debt: Debt): number {
  return Math.max(0, debt.remainingAmount ?? Number(debt.amount))
}

/** Активные долги — для итогов «мне должны / я должен» */
function isOpenDebt(debt: Debt): boolean {
  return debt.status === 'active' || debt.status === 'overdue'
}

/**
 * Формирует сводку, список долгов и единую ленту платежей по контакту.
 */
export function buildContactHistory(debts: Debt[]): ContactHistoryData {
  const sortedDebts = [...debts].sort(
    (a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime()
  )

  const byCurrency = new Map<string, ContactCurrencySummary>()

  for (const debt of sortedDebts) {
    if (!isOpenDebt(debt)) {
      continue
    }

    const currency = normalizeCurrency(debt.currency)
    const remaining = debtRemaining(debt)
    const row = byCurrency.get(currency) ?? {
      currency,
      totalIOwe: 0,
      totalOwedToMe: 0,
      netPosition: 0
    }

    if (debt.type === 'iOwe') {
      row.totalIOwe += remaining
    } else {
      row.totalOwedToMe += remaining
    }

    row.netPosition = row.totalOwedToMe - row.totalIOwe
    byCurrency.set(currency, row)
  }

  const payments: ContactPaymentEntry[] = []

  for (const debt of sortedDebts) {
    for (const payment of debt.payments ?? []) {
      payments.push({
        ...payment,
        debtId: debt.id,
        debtType: debt.type,
        debtPurpose: debt.purpose,
        currency: normalizeCurrency(debt.currency)
      })
    }
  }

  payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return {
    debts: sortedDebts,
    summaries: Array.from(byCurrency.values()).sort((a, b) => a.currency.localeCompare(b.currency)),
    payments
  }
}
