/** Пресеты иконок счёта: SVG-карточки / монеты / часы */

export type AccountIconGlyph = 'card' | 'coins' | 'hourglass' | 'wallet'

export interface AccountIconPreset {
  id: string
  /** Значение, сохраняемое в accounts.icon */
  icon: string
  /** Цвет фона (также в accounts.color) */
  color: string
  label: string
  type: 'cash' | 'card' | 'savings'
  glyph: AccountIconGlyph
  /** CSS background (solid или gradient) */
  bg: string
  /** Цвет линий SVG */
  fg: string
}

export const ACCOUNT_ICON_PRESETS: AccountIconPreset[] = [
  {
    id: 'coins',
    icon: 'coins',
    color: '#7C3AED',
    label: 'Наличные',
    type: 'cash',
    glyph: 'coins',
    bg: 'linear-gradient(180deg, #8B5CF6 0%, #6D28D9 100%)',
    fg: '#FFFFFF'
  },
  {
    id: 'card-yellow',
    icon: 'card-yellow',
    color: '#FACC15',
    label: 'Жёлтая',
    type: 'card',
    glyph: 'card',
    bg: '#FACC15',
    fg: '#5C3D0E'
  },
  {
    id: 'card-red',
    icon: 'card-red',
    color: '#DC2626',
    label: 'Красная',
    type: 'card',
    glyph: 'card',
    bg: 'radial-gradient(circle at 50% 35%, #F87171 0%, #B91C1C 100%)',
    fg: '#FECACA'
  },
  {
    id: 'card-green',
    icon: 'card-green',
    color: '#166534',
    label: 'Зелёная',
    type: 'card',
    glyph: 'card',
    bg: 'radial-gradient(circle at 50% 40%, #15803D 0%, #14532D 100%)',
    fg: '#D1FAE5'
  },
  {
    id: 'card-blue',
    icon: 'card-blue',
    color: '#2563EB',
    label: 'Синяя',
    type: 'card',
    glyph: 'card',
    bg: 'linear-gradient(135deg, #1D4ED8 0%, #60A5FA 100%)',
    fg: '#FFFFFF'
  },
  {
    id: 'card-sky',
    icon: 'card-sky',
    color: '#38BDF8',
    label: 'Голубая',
    type: 'card',
    glyph: 'card',
    bg: 'radial-gradient(circle at 50% 70%, #E0F2FE 0%, #38BDF8 55%, #0284C7 100%)',
    fg: '#FFFFFF'
  },
  {
    id: 'card-sand',
    icon: 'card-sand',
    color: '#78716C',
    label: 'Песочная',
    type: 'card',
    glyph: 'card',
    bg: 'linear-gradient(135deg, #D6D3D1 0%, #57534E 100%)',
    fg: '#FFFFFF'
  },
  {
    id: 'card-mono',
    icon: 'card-mono',
    color: '#9CA3AF',
    label: 'Моно',
    type: 'card',
    glyph: 'card',
    bg: 'radial-gradient(circle at 50% 70%, #FFFFFF 0%, #D1D5DB 100%)',
    fg: '#111827'
  },
  {
    id: 'hourglass',
    icon: 'hourglass',
    color: '#B91C1C',
    label: 'Накопления',
    type: 'savings',
    glyph: 'hourglass',
    bg: 'linear-gradient(135deg, #7F1D1D 0%, #EF4444 55%, #B91C1C 100%)',
    fg: '#FFFFFF'
  },
  {
    id: 'wallet',
    icon: 'wallet',
    color: '#E11D48',
    label: 'Кошелёк',
    type: 'cash',
    glyph: 'wallet',
    bg: 'linear-gradient(135deg, #7F1D1D 0%, #EF4444 50%, #BE123C 100%)',
    fg: '#FFFFFF'
  }
]

const LEGACY_EMOJI_TO_ID: Record<string, string> = {
  '💰': 'coins',
  '💵': 'coins',
  '💳': 'card-blue',
  '🏦': 'card-blue',
  '💎': 'card-sky',
  '🏠': 'card-sand',
  '🚗': 'card-yellow',
  '📈': 'hourglass',
  '👛': 'wallet'
}

/** Подбирает пресет по сохранённым icon/color или типу счёта */
export function resolveAccountIconPreset(
  icon?: string | null,
  color?: string | null,
  type?: string | null
): AccountIconPreset {
  if (icon) {
    const byId = ACCOUNT_ICON_PRESETS.find((preset) => preset.id === icon || preset.icon === icon)
    if (byId) {
      return byId
    }

    const legacyId = LEGACY_EMOJI_TO_ID[icon]
    if (legacyId) {
      const legacy = ACCOUNT_ICON_PRESETS.find((preset) => preset.id === legacyId)
      if (legacy) {
        return legacy
      }
    }
  }

  if (type === 'cash') {
    return ACCOUNT_ICON_PRESETS[0]
  }

  if (type === 'savings') {
    return ACCOUNT_ICON_PRESETS.find((preset) => preset.id === 'hourglass') ?? ACCOUNT_ICON_PRESETS[0]
  }

  if (color) {
    const byColor = ACCOUNT_ICON_PRESETS.find((preset) => preset.color === color)
    if (byColor) {
      return byColor
    }
  }

  return ACCOUNT_ICON_PRESETS[4]
}

/** Подпись для select (без эмодзи) */
export function getAccountOptionLabel(account: { name: string }): string {
  return account.name
}

/** Цвет фона иконки счёта */
export function getAccountDisplayColor(account: {
  icon?: string | null
  color?: string | null
  type?: string | null
}): string {
  return resolveAccountIconPreset(account.icon, account.color, account.type).color
}
