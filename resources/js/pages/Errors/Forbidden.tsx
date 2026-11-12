import { Link } from '@inertiajs/react'
import { ShieldOff } from 'lucide-react'
import { PageHeader } from '../../components/shared/PageHeader'
import { buttonVariants, EmptyState } from '../../components/ui'

export default function Forbidden({ message }: { message?: string }) {
  return (
    <div className="mx-auto max-w-content">
      <PageHeader title="No access" />
      <EmptyState
        icon={ShieldOff}
        title="This page is restricted"
        description={message || "Your role can't open this page. Ask management if you think this is a mistake."}
        action={
          <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
            Back to home
          </Link>
        }
      />
    </div>
  )
}
