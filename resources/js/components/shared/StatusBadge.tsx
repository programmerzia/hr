import { Badge } from '../ui'
import { cn } from '../../lib/cn'
import { statusMeta } from '../../lib/status'
import type { BadgeVariant } from '../../types'

const dotColor: Record<BadgeVariant, string> = {
  neutral: 'bg-fg-subtle',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  accent: 'bg-accent',
}

/** 6px status dot. `pulse` adds a slow 2s ring (off under prefers-reduced-motion). */
export function StatusDot({
  variant,
  pulse,
  className,
}: {
  variant: BadgeVariant
  pulse?: boolean
  className?: string
}) {
  return (
    <span className={cn('relative inline-flex size-1.5 shrink-0', className)} aria-hidden>
      {pulse && (
        <span
          className={cn(
            'absolute inset-0 rounded-full motion-safe:animate-status-pulse motion-reduce:hidden',
            dotColor[variant],
          )}
        />
      )}
      <span className={cn('relative size-1.5 rounded-full', dotColor[variant])} />
    </span>
  )
}

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const meta = statusMeta(status)
  return (
    <Badge variant={meta.variant} className={cn('gap-1.5', className)}>
      <StatusDot variant={meta.variant} pulse={status === 'working'} />
      {label ?? meta.label}
    </Badge>
  )
}
