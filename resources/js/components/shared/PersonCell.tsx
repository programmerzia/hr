import { Avatar } from '../ui'
import { cn } from '../../lib/cn'

interface PersonCellProps {
  name: string
  subtitle?: string
  size?: 'sm' | 'md'
  /** Presence ring around the avatar. */
  presence?: 'success' | 'warning' | 'neutral'
  /** Subtitle under the name instead of beside it (dense tables). */
  stacked?: boolean
  className?: string
}

export function PersonCell({ name, subtitle, size = 'sm', presence, stacked, className }: PersonCellProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <Avatar name={name} size={size} presence={presence} className={presence ? 'mx-0.5' : undefined} />
      {stacked ? (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-medium">{name}</span>
          {subtitle && <span className="truncate text-xs text-fg-muted">{subtitle}</span>}
        </span>
      ) : (
        <>
          <span className="truncate font-medium">{name}</span>
          {subtitle && <span className="truncate text-fg-muted">{subtitle}</span>}
        </>
      )}
    </div>
  )
}
