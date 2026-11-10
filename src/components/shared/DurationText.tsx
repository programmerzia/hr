import { formatDuration } from '../../lib/format'
import { cn } from '../../lib/cn'

export function DurationText({ seconds, className }: { seconds: number; className?: string }) {
  return <span className={cn('tabular-nums', className)}>{formatDuration(seconds)}</span>
}
