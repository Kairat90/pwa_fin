/**
 * Контрастная палитра для диаграмм.
 * Цвета категорий из БД не используются — только эта палитра (перемешивается по seed).
 */
export const CHART_COLORS = [
  '#4F46E5',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#3B82F6',
  '#84CC16',
  '#06B6D4',
  '#A855F7',
  '#E11D48',
  '#0EA5E9',
  '#22C55E',
  '#D946EF',
  '#CA8A04',
  '#7C3AED',
  '#059669',
  '#DC2626',
  '#2563EB',
  '#DB2777',
  '#0891B2',
  '#65A30D',
  '#C026D3',
  '#EA580C',
  '#4D7C0F',
  '#9333EA',
  '#0369A1',
  '#BE123C',
  '#15803D',
  '#64748B'
] as const

/** Цвет секции «Прочее» */
export const CHART_OTHER_COLOR = '#9CA3AF'

function hashSeed(input: string): number {
  let hash = 2166136261

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

/** Детерминированное перемешивание — «случайный» порядок, стабильный при перерисовке */
function seededShuffle<T>(items: T[], seed: string): T[] {
  const result = [...items]
  let state = hashSeed(seed)

  for (let i = result.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const j = state % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}

/**
 * Набор контрастных цветов для секций диаграммы.
 * @param count — число секций (без «Прочее»)
 * @param seed — ключ стабильности (например id категорий через «|»)
 */
export function buildChartPalette(count: number, seed: string): string[] {
  if (count <= 0) {
    return []
  }

  const shuffled = seededShuffle([...CHART_COLORS], seed || 'chart')
  const palette: string[] = []

  for (let i = 0; i < count; i++) {
    palette.push(shuffled[i % shuffled.length])
  }

  return palette
}

/** Отступы и позиция круговой диаграммы относительно легенды */
export const PIE_CHART_LAYOUT = {
  margin: { top: 8, right: 16, bottom: 72, left: 16 },
  pie: {
    cx: '50%',
    cy: '42%',
    paddingAngle: 2
  },
  legend: {
    verticalAlign: 'bottom' as const,
    align: 'center' as const,
    wrapperStyle: { paddingTop: 24, fontSize: 12, lineHeight: '1.6' },
    iconSize: 10
  }
}

/** Компактная версия для дашборда (меньше категорий) */
export const PIE_CHART_LAYOUT_COMPACT = {
  margin: { top: 8, right: 12, bottom: 64, left: 12 },
  pie: {
    cx: '50%',
    cy: '40%',
    paddingAngle: 2
  },
  legend: {
    verticalAlign: 'bottom' as const,
    align: 'center' as const,
    wrapperStyle: { paddingTop: 20, fontSize: 11, lineHeight: '1.5' },
    iconSize: 10
  }
}
