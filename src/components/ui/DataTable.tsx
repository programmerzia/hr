import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Input } from './Input'

interface ToolbarProps {
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: ReactNode
  actions?: ReactNode
  className?: string
}

/** Search left, filters next to it, actions right. */
export function TableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search',
  filters,
  actions,
  className,
}: ToolbarProps) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-center gap-2', className)}>
      {onSearchChange && (
        <div className="relative w-full sm:w-64">
          <Search
            size={16}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
            aria-hidden
          />
          <Input
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-8"
          />
        </div>
      )}
      {filters}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function FilterChip({
  label,
  value,
  onClear,
  className,
}: {
  label: string
  value: string
  onClear?: () => void
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded border border-border-strong bg-surface px-2 text-sm',
        className,
      )}
    >
      <span className="text-fg-muted">{label}</span>
      <span className="font-medium">{value}</span>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${label} filter`}
          className="rounded text-fg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <X size={14} />
        </button>
      )}
    </span>
  )
}

export function TableFooter({
  count,
  noun = 'items',
  children,
  className,
}: {
  count: number
  noun?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mt-3 flex items-center justify-between text-sm text-fg-muted', className)}>
      <span>
        {count} {noun}
      </span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}
