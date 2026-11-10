import { Link, useRouteError } from 'react-router'
import { buttonVariants, EmptyState } from '../components/ui'
import { TriangleAlert } from 'lucide-react'

/** Shown when a page throws while rendering. */
export function RouteError() {
  const error = useRouteError()
  const detail = error instanceof Error ? error.message : undefined
  return (
    <div className="mx-auto max-w-content pt-10">
      <EmptyState
        icon={TriangleAlert}
        title="This page could not be shown"
        description={detail ?? 'Something went wrong while loading it.'}
        action={
          <Link to="/" reloadDocument className={buttonVariants({ variant: 'secondary' })}>
            Back to home
          </Link>
        }
      />
    </div>
  )
}
