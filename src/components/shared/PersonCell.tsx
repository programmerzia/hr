import { Avatar } from '../ui'
import { cn } from '../../lib/cn'

interface PersonCellProps {
  name: string
  subtitle?: string
  size?: 'sm' | 'md'
  className?: string
}

export function PersonCell({ name, subtitle, size = 'sm', className }: PersonCellProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <Avatar name={name} size={size} />
      <span className="truncate font-medium">{name}</span>
      {subtitle && <span className="truncate text-fg-muted">{subtitle}</span>}
    </div>
  )
}
