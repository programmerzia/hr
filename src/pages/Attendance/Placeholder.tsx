import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyState } from '../../components/ui'

export function AttendancePlaceholder({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mx-auto max-w-content">
      <PageHeader title={title} description={description} />
      <div className="rounded-md border border-border bg-surface">
        <EmptyState title="Coming in a later wave" description="This page is not built yet." />
      </div>
    </div>
  )
}
