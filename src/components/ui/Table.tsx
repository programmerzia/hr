import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '../../lib/cn'

/** Wrapper provides border and horizontal scroll. Rows are 32px. */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  )
}

export function Thead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('sticky top-0 z-10 bg-surface-2', className)} {...props} />
}

export function Tbody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('border-b border-border last:border-b-0 hover:bg-surface-2', className)}
      {...props}
    />
  )
}

interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean
  sort?: 'asc' | 'desc' | null
  onSort?: () => void
}

export function Th({ className, numeric, sort, onSort, children, ...props }: ThProps) {
  const ariaSort = sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : undefined
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cn(
        'h-8 whitespace-nowrap border-b border-border px-3 text-xs font-medium text-fg-muted',
        numeric ? 'text-right' : 'text-left',
        className,
      )}
      {...props}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            'inline-flex items-center gap-1 rounded hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            numeric && 'flex-row-reverse',
          )}
        >
          {children}
          {sort === 'asc' && <ArrowUp size={12} />}
          {sort === 'desc' && <ArrowDown size={12} />}
        </button>
      ) : (
        children
      )}
    </th>
  )
}

export function Td({
  className,
  numeric,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'h-8 px-3 py-1 align-middle text-fg',
        numeric && 'text-right font-mono tabular-nums',
        className,
      )}
      {...props}
    />
  )
}
