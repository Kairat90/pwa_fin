/**
 * Палитра для диаграмм — достаточно оттенков, чтобы секции не повторялись.
 * При большем числе категорий цвета циклически повторяются с последнего.
 */
export const CHART_COLORS = [
  '#4F46E5', // indigo
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#3B82F6', // blue
  '#84CC16', // lime
  '#06B6D4', // cyan
  '#A855F7', // purple
  '#E11D48', // rose
  '#0EA5E9', // sky
  '#22C55E', // green
  '#D946EF', // fuchsia
  '#64748B', // slate
  '#CA8A04', // yellow-dark
  '#7C3AED', // violet-dark
  '#059669', // emerald-dark
  '#DC2626', // red-dark
  '#2563EB', // blue-dark
  '#DB2777', // pink-dark
  '#0891B2', // cyan-dark
  '#65A30D', // lime-dark
  '#C026D3', // fuchsia-dark
  '#EA580C', // orange-dark
  '#4D7C0F', // olive
  '#9333EA', // purple-mid
  '#0369A1', // sky-dark
  '#BE123C', // rose-dark
  '#15803D'  // green-dark
] as const

/** Цвет «Прочее» на диаграммах */
export const CHART_OTHER_COLOR = '#9CA3AF'

/** Цвет секции по индексу (если у категории нет своего цвета) */
export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

/** Цвет категории: свой из БД или из палитры по позиции */
export function resolveCategoryChartColor(categoryColor: string | undefined, index: number): string {
  if (categoryColor && categoryColor.trim()) {
    return categoryColor
  }

  return getChartColor(index)
}
