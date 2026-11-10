import { Skeleton } from '../ui/Skeleton'

/** Suspense fallback shown while a route chunk loads. */
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-content" role="status" aria-label="Loading">
      <Skeleton className="mb-1 h-6 w-48" />
      <Skeleton className="mb-6 h-4 w-72" />
      <Skeleton className="mb-3 h-8 w-full" />
      <Skeleton className="mb-3 h-8 w-full" />
      <Skeleton className="h-8 w-2/3" />
    </div>
  )
}
