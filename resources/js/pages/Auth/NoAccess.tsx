import { ShieldOff } from 'lucide-react'
import { Link } from '@inertiajs/react'
import { buttonVariants, EmptyState } from '../../components/ui'

export function NoAccess() {
  return (
    <EmptyState
      icon={ShieldOff}
      title="You don't have access"
      description="Your role can't open this page. Ask HR if you think this is a mistake."
      action={
        <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
          Go to home
        </Link>
      }
    />
  )
}
