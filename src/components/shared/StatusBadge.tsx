import { Badge } from '../ui'
import { statusMeta } from '../../lib/status'

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const meta = statusMeta(status)
  return (
    <Badge variant={meta.variant} className={className}>
      {label ?? meta.label}
    </Badge>
  )
}
