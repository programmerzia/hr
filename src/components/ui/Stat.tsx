import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Card } from './Card'

interface StatProps {
  label: string
  value: ReactNode
  delta?: { value: string; tone?: 'success' | 'danger' | 'neutral' }
  className?: string
}

const tones = { success: 'text-success', danger: 'text-danger', neutral: 'text-fg-muted' }

export function Stat({ label, value, delta, className }: StatProps) {
  return (
    <Card className={cn('p-4', className)}>
      <p className="text-sm text-fg-muted">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{value}</p>
      {delta && <p className={cn('mt-1 text-xs', tones[delta.tone ?? 'neutral'])}>{delta.value}</p>}
    </Card>
  )
}
