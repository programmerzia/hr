import type { ReactNode } from 'react'
import { chartColor, type ChartColor } from './colors'

interface RingProps {
  /** 0..100 */
  value: number
  size?: number
  stroke?: number
  color?: ChartColor
  children?: ReactNode
  'aria-label': string
  className?: string
}

/** Progress ring. The center takes any content (usually a percent). */
export function Ring({ value, size = 48, stroke = 4, color = 'accent', children, className, 'aria-label': ariaLabel }: RingProps) {
  const pct = Math.min(100, Math.max(0, value))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div
      data-testid="ring"
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="rgb(var(--surface-2))" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={chartColor(color)}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset 240ms ease-out' }}
        />
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
    </div>
  )
}
