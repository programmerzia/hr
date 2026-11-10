import { cn } from '../../lib/cn'
import { formatClock } from '../../lib/format'

export function Clock({
  seconds,
  size = 'lg',
  className,
}: {
  seconds: number
  size?: 'md' | 'lg'
  className?: string
}) {
  return (
    <span
      className={cn(
        'font-mono font-medium tabular-nums',
        size === 'lg' ? 'text-[40px] leading-[48px]' : 'text-[28px] leading-9',
        className,
      )}
    >
      {formatClock(seconds)}
    </span>
  )
}
