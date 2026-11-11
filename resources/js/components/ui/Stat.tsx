import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Card } from './Card'

interface StatProps {
  label: string
  value: ReactNode
  /** Muted icon in a 32px circle at the right. */
  icon?: LucideIcon
  delta?: { value: string; tone?: 'success' | 'danger' | 'neutral' }
  className?: string
}

const tones = { success: 'text-success', danger: 'text-danger', neutral: 'text-fg-muted' }

export function Stat({ label, value, icon: Icon, delta, className }: StatProps) {
  return (
    <Card className={cn('flex items-start justify-between gap-3 p-4', className)}>
      <div className="min-w-0">
        <p className="text-sm text-fg-muted">{label}</p>
        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</p>
        {delta && <p className={cn('mt-1 text-xs', tones[delta.tone ?? 'neutral'])}>{delta.value}</p>}
      </div>
      {Icon && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-muted" aria-hidden>
          <Icon size={16} />
        </span>
      )}
    </Card>
  )
}
