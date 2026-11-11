import { Link, useLocation } from 'react-router'
import { cn } from '../../lib/cn'

/** Renders KEY-123 in mono as a link that opens the task drawer via `?task=KEY-123`. */
export function TaskKey({ taskKey, className }: { taskKey: string; className?: string }) {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  params.set('task', taskKey)
  return (
    <Link
      to={{ search: `?${params.toString()}` }}
      className={cn(
        'rounded font-mono text-sm text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        className,
      )}
    >
      {taskKey}
    </Link>
  )
}
