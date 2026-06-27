import React from 'react'

type PieLabelProps = {
  cx?: number
  cy?: number
  midAngle?: number
  innerRadius?: number
  outerRadius?: number
  percent?: number
}

const RADIAN = Math.PI / 180

/** Подпись процента на секторе круговой диаграммы */
export function renderPiePercentLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  percent = 0
}: PieLabelProps): React.ReactElement | null {
  if (percent < 0.04) {
    return null
  }

  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
      stroke="rgba(0,0,0,0.35)"
      strokeWidth={0.6}
      paintOrder="stroke"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

/** Формат подписи в легенде: название и доля */
export function formatPieLegendLabel(name: string, percentage?: number): string {
  if (percentage === undefined || Number.isNaN(percentage)) {
    return name
  }

  return `${name} — ${percentage.toFixed(0)}%`
}
