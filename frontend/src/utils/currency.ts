export const DEFAULT_CURRENCY = 'KZT'

export const CURRENCIES = [
  { code: 'KZT', label: '₸ Тенге (KZT)' },
  { code: 'RUB', label: '₽ Рубль (RUB)' },
  { code: 'USD', label: '$ Доллар (USD)' },
  { code: 'EUR', label: '€ Евро (EUR)' }
] as const

const CURRENCY_ALIASES: Record<string, string> = {
  KZ: 'KZT',
  KZT: 'KZT',
  RU: 'RUB',
  RUB: 'RUB',
  USD: 'USD',
  EUR: 'EUR'
}

/** Нормализует код валюты (KZ → KZT и т.д.) */
export function normalizeCurrency(currency: string): string {
  const upper = currency.trim().toUpperCase()
  return CURRENCY_ALIASES[upper] || upper
}

export function formatCurrency(amount: number, currency = DEFAULT_CURRENCY): string {
  const code = normalizeCurrency(currency)

  try {
    return new Intl.NumberFormat('ru-KZ', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount)
  } catch {
    return `${amount.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${code}`
  }
}

export function parseAmount(value: string | number): number {
  if (typeof value === 'number') return value
  return parseFloat(value.replace(/\s/g, '').replace(',', '.')) || 0
}
