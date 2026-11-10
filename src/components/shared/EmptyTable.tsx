import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { EmptyState } from '../ui'

/** Bordered empty block that takes a table's place when a list has no rows. */
export function EmptyTable({
  icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-md border border-border bg-surface">
      <EmptyState icon={icon} title={title} description={description} action={action} />
    </div>
  )
}
