import { Account } from '../types'
import { normalizeCurrency } from './currency'

/** Активный счёт по умолчанию: из профиля или первый в валюте пользователя */
export function resolveDefaultAccount(
  accounts: Account[],
  defaultAccountId?: string | null,
  preferredCurrency = 'KZT'
): Account | null {
  const activeAccounts = accounts.filter((account) => !account.isArchived)

  if (activeAccounts.length === 0) {
    return null
  }

  if (defaultAccountId) {
    const fromProfile = activeAccounts.find((account) => account.id === defaultAccountId)

    if (fromProfile) {
      return fromProfile
    }
  }

  const currencyCode = normalizeCurrency(preferredCurrency)
  const byCurrency = activeAccounts.filter(
    (account) => normalizeCurrency(account.currency) === currencyCode
  )

  if (byCurrency.length > 0) {
    return byCurrency[0]
  }

  return activeAccounts[0]
}
