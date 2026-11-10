import { chartColor, type ChartColor } from './colors'

interface SparklineProps {
  values: number[]
  color?: ChartColor
  width?: number
  height?: number
  'aria-label': string
  className?: string
}

/** Single series line with an 8% area under it. */
export function Sparkline({ values, color = 'chart-1', width = 120, height = 32, className, 'aria-label': ariaLabel }: SparklineProps) {
  if (values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = Math.max(max - min, 1)
  const pad = 2
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - pad - ((v - min) / span) * (height - pad * 2),
  ])
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `0,${height} ${line} ${width},${height}`
  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: '100%', height }}
    >
      <polygon points={area} fill={chartColor(color)} fillOpacity={0.08} />
      <polyline
        points={line}
        fill="none"
        stroke={chartColor(color)}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
