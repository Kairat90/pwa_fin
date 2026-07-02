import { Debt } from '../types'
import { normalizeCurrency } from './currency'

export type DebtStatsByCurrency = {
  currency: string
  totalIOwe: number
  totalOwedToMe: number
  netPosition: number
}

export type DebtStats = {
  totalIOwe: number
  totalOwedToMe: number
  netPosition: number
  overdueCount: number
  activeCount: number
  totalDebts: number
  byCurrency: DebtStatsByCurrency[]
}

function debtRemaining(debt: Debt): number {
  return Math.max(0, debt.remainingAmount ?? Number(debt.amount))
}

/** Сводка по открытым долгам (только погашения уменьшают остаток) */
export function computeDebtStats(debts: Debt[]): DebtStats {
  const openDebts = debts.filter((d) => d.status === 'active' || d.status === 'overdue')
  const byCurrencyMap = new Map<string, DebtStatsByCurrency>()

  let overdueCount = 0
  let activeCount = 0

  for (const debt of openDebts) {
    if (debt.status === 'overdue') {
      overdueCount += 1
    } else {
      activeCount += 1
    }

    const currency = normalizeCurrency(debt.currency)
    const remaining = debtRemaining(debt)
    const row = byCurrencyMap.get(currency) ?? {
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
    byCurrencyMap.set(currency, row)
  }

  const byCurrency = Array.from(byCurrencyMap.values()).sort((a, b) => a.currency.localeCompare(b.currency))

  const totalIOwe = byCurrency.reduce((s, r) => s + r.totalIOwe, 0)
  const totalOwedToMe = byCurrency.reduce((s, r) => s + r.totalOwedToMe, 0)

  return {
    totalIOwe,
    totalOwedToMe,
    netPosition: totalOwedToMe - totalIOwe,
    overdueCount,
    activeCount,
    totalDebts: openDebts.length,
    byCurrency
  }
}

/** Одна валюта в сводке — можно показывать одной строкой без разбивки */
export function isSingleCurrencyStats(stats: DebtStats): boolean {
  return stats.byCurrency.length <= 1
}
