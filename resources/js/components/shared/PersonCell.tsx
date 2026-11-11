import { Avatar } from '../ui'
import { cn } from '../../lib/cn'

interface PersonCellProps {
  name: string
  subtitle?: string
  size?: 'sm' | 'md'
  /** Presence ring around the avatar. */
  presence?: 'success' | 'warning' | 'neutral'
  className?: string
}

export function PersonCell({ name, subtitle, size = 'sm', presence, className }: PersonCellProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <Avatar name={name} size={size} presence={presence} className={presence ? 'mx-0.5' : undefined} />
      <span className="truncate font-medium">{name}</span>
      {subtitle && <span className="truncate text-fg-muted">{subtitle}</span>}
    </div>
  )
}
