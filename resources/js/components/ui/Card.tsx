import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/** `interactive` adds the 1px hover lift for cards that are links or buttons. */
export function Card({
  className,
  interactive,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-surface shadow-xs', interactive && 'card-lift', className)}
      {...props}
    />
  )
}

export function CardHeader({
  className,
  title,
  actions,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & { title?: string; actions?: React.ReactNode }) {
  return (
    <div
      className={cn('flex min-h-12 items-center justify-between gap-3 border-b border-border px-3.5 py-2.5', className)}
      {...props}
    >
      {title ? <h2 className="text-lg font-semibold">{title}</h2> : children}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-3.5', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-end gap-2 border-t border-border px-4 py-3', className)}
      {...props}
    />
  )
}
