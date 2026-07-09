/** Пресеты иконок счёта: наличные + цветные банковские карты */
export interface AccountIconPreset {
  id: string
  icon: string
  color: string
  label: string
  type: 'cash' | 'card'
}

export const ACCOUNT_ICON_PRESETS: AccountIconPreset[] = [
  { id: 'cash', icon: '💰', color: '#10B981', label: 'Наличные', type: 'cash' },
  { id: 'card-blue', icon: '💳', color: '#4F46E5', label: 'Синяя карта', type: 'card' },
  { id: 'card-red', icon: '💳', color: '#EF4444', label: 'Красная карта', type: 'card' },
  { id: 'card-orange', icon: '💳', color: '#F59E0B', label: 'Оранжевая карта', type: 'card' },
  { id: 'card-purple', icon: '💳', color: '#8B5CF6', label: 'Фиолетовая карта', type: 'card' },
  { id: 'card-teal', icon: '💳', color: '#14B8A6', label: 'Бирюзовая карта', type: 'card' },
  { id: 'card-gray', icon: '💳', color: '#6B7280', label: 'Серая карта', type: 'card' }
]

/** Подбирает пресет по сохранённым icon/color или типу счёта */
export function resolveAccountIconPreset(
  icon?: string | null,
  color?: string | null,
  type?: string | null
): AccountIconPreset {
  const byIconAndColor = ACCOUNT_ICON_PRESETS.find((preset) => preset.icon === icon && preset.color === color)
  if (byIconAndColor) {
    return byIconAndColor
  }

  if (icon === '💰' || type === 'cash') {
    return ACCOUNT_ICON_PRESETS[0]
  }

  const byColor = ACCOUNT_ICON_PRESETS.find((preset) => preset.color === color)
  if (byColor) {
    return byColor
  }

  return ACCOUNT_ICON_PRESETS[1]
}

/** Иконка для отображения (нормализует устаревшие варианты) */
export function getAccountDisplayIcon(account: { icon?: string | null; type?: string | null }): string {
  return resolveAccountIconPreset(account.icon, undefined, account.type).icon
}

/** Цвет фона иконки счёта */
export function getAccountDisplayColor(account: {
  icon?: string | null
  color?: string | null
  type?: string | null
}): string {
  return resolveAccountIconPreset(account.icon, account.color, account.type).color
}
