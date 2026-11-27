import { Link } from '@inertiajs/react'
import { Button, buttonVariants } from '../../components/ui'
import { Logomark } from '../../components/shared/Logomark'

interface Props {
  status: number
  title: string
  message: string
}

/** Production error page (404, 419, 429, 500, 503). Bare layout so it still renders when the app shell is what failed. */
export default function ErrorPage({ status, title, message }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <Logomark />
        </div>
        <p className="num text-sm text-fg-subtle">{status}</p>
        <h1 className="mt-1 text-lg font-semibold text-fg">{title}</h1>
        <p className="mt-2 text-sm text-fg-muted">{message}</p>
        <div className="mt-6 flex justify-center gap-2">
          {status === 419 || status === 503 || status === 500 || status === 429 ? (
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload
            </Button>
          ) : null}
          <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}

ErrorPage.layout = null
