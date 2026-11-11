import { ChevronRight } from 'lucide-react'
import { Link } from '@inertiajs/react'
import { cn } from '../../lib/cn'

export interface Crumb {
  label: string
  to?: string
}

export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('mb-1 text-sm text-fg-muted', className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} aria-hidden />}
            {c.to && i < items.length - 1 ? (
              <Link
                href={c.to}
                className="rounded hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {c.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? 'page' : undefined}>{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
