import type { ReactNode } from 'react'
import { useBreadcrumb, type Crumb } from '../../app/pageTitle'
import { cn } from '../../lib/cn'

interface PageHeaderProps {
  title: string
  description?: string
  /** Shown in the top bar (module › record), not above the title. */
  breadcrumb?: Crumb[]
  actions?: ReactNode
  /** Tabs row rendered under the title. */
  tabs?: ReactNode
  className?: string
}

export function PageHeader({ title, description, breadcrumb, actions, tabs, className }: PageHeaderProps) {
  useBreadcrumb(breadcrumb)
  return (
    <header className={cn('mb-6', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{title}</h1>
          {description && <p className="mt-0.5 text-base text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="mt-3">{tabs}</div>}
    </header>
  )
}
