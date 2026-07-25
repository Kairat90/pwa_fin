import { cn } from '../../utils/cn'
import {
  ACCOUNT_ICON_PRESETS,
  AccountIconPreset,
  resolveAccountIconPreset
} from '../../utils/accountIcons'

interface AccountIconProps {
  presetId?: string | null
  icon?: string | null
  color?: string | null
  type?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  title?: string
}

const SIZE_CLASS = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
  xl: 'w-12 h-12'
} as const

/** Карта: рамка + полоса + чип */
function CardGlyph({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="w-[62%] h-[62%]" fill="none" aria-hidden>
      <rect x="3.2" y="5.2" width="17.6" height="13.6" rx="3.2" stroke={color} strokeWidth="2.4" />
      <path d="M3.2 10.2h17.6" stroke={color} strokeWidth="2.4" strokeLinecap="butt" />
      <rect x="6.2" y="14.2" width="5" height="2.3" rx="1.15" fill={color} />
    </svg>
  )
}

/** Две монеты (наличные) */
function CoinsGlyph({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="w-[64%] h-[64%]" fill="none" aria-hidden>
      <ellipse cx="14.2" cy="8.2" rx="4.6" ry="3.2" stroke={color} strokeWidth="2.2" />
      <path
        d="M9.6 8.2v2.4c0 1.8 2.1 3.2 4.6 3.2s4.6-1.4 4.6-3.2V8.2"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <ellipse cx="9.8" cy="11.4" rx="4.6" ry="3.2" stroke={color} strokeWidth="2.2" />
      <path
        d="M5.2 11.4v2.6c0 1.8 2.1 3.2 4.6 3.2s4.6-1.4 4.6-3.2v-1.2"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Песочные часы */
function HourglassGlyph({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="w-[58%] h-[58%]" fill="none" aria-hidden>
      <path d="M7 5.2h10" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M7 18.8h10" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
      <path
        d="M8.2 5.2c0 3.4 2.4 5.2 3.8 6.8C13.4 13.6 15.8 15.4 15.8 18.8"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M15.8 5.2c0 3.4-2.4 5.2-3.8 6.8C10.6 13.6 8.2 15.4 8.2 18.8"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Кошелёк с клапаном справа */
function WalletGlyph({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="w-[66%] h-[66%]" fill="none" aria-hidden>
      <path
        d="M5 8.5c0-1.7 1.3-3 3-3h8c1.7 0 3 1.3 3 3v1.2h-2.8c-1.3 0-2.4 1-2.4 2.3s1.1 2.3 2.4 2.3H19V15.5c0 1.7-1.3 3-3 3H8c-1.7 0-3-1.3-3-3V8.5z"
        stroke={color}
        strokeWidth="2.35"
        strokeLinejoin="round"
      />
      <path
        d="M13.8 12h5.7"
        stroke={color}
        strokeWidth="2.35"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Glyph({ preset }: { preset: AccountIconPreset }) {
  if (preset.glyph === 'coins') {
    return <CoinsGlyph color={preset.fg} />
  }

  if (preset.glyph === 'hourglass') {
    return <HourglassGlyph color={preset.fg} />
  }

  if (preset.glyph === 'wallet') {
    return <WalletGlyph color={preset.fg} />
  }

  return <CardGlyph color={preset.fg} />
}

/** Цветной значок счёта (squircle + SVG) */
export function AccountIcon({
  presetId,
  icon,
  color,
  type,
  size = 'md',
  className,
  title
}: AccountIconProps) {
  const preset = presetId
    ? (ACCOUNT_ICON_PRESETS.find((item) => item.id === presetId) ?? ACCOUNT_ICON_PRESETS[0])
    : resolveAccountIconPreset(icon, color, type)

  return (
    <div
      className={cn(
        SIZE_CLASS[size],
        'shrink-0 rounded-[22%] flex items-center justify-center overflow-hidden shadow-sm',
        className
      )}
      style={{ background: preset.bg }}
      title={title ?? preset.label}
      aria-hidden={!title}
    >
      <Glyph preset={preset} />
    </div>
  )
}
