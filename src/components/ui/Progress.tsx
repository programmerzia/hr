import { cn } from '../../lib/cn'

interface ProgressProps {
  value: number
  max?: number
  tone?: 'accent' | 'success' | 'warning' | 'danger'
  className?: string
  'aria-label'?: string
}

const tones = { accent: 'bg-accent', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' }

export function Progress({ value, max = 100, tone = 'accent', className, ...aria }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-2', className)}
      {...aria}
    >
      <div className={cn('h-full rounded-full', tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  )
}
