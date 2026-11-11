import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyState } from '../../components/ui'

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-content">
      <PageHeader title="Settings" />
      <div className="rounded-md border border-border bg-surface">
        <EmptyState title="Coming in a later wave" description="This page is not built yet." />
      </div>
    </div>
  )
}
