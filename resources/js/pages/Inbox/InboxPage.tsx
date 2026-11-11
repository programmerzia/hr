import { router } from '@inertiajs/react'
import { AtSign, CalendarDays, CheckCheck, ClipboardCheck, FileText, Receipt, Wallet, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button, Card, EmptyState, SegmentedControl } from '../../components/ui'
import { useShared } from '../../inertia/props'
import { relativeTime } from '../../lib/format'
import type { Notification, NotificationKind } from '../../types'

type Filter = 'all' | 'unread'

const icons: Record<NotificationKind, LucideIcon> = {
  leave: CalendarDays,
  regularization: ClipboardCheck,
  claim: Receipt,
  payroll: Wallet,
  invoice: FileText,
  mention: AtSign,
}

const kindLabels: Record<NotificationKind, string> = {
  leave: 'Leave',
  regularization: 'Regularization',
  claim: 'Claim',
  payroll: 'Payroll',
  invoice: 'Invoice',
  mention: 'Mention',
}

const empty: Record<Filter, { title: string; description: string }> = {
  all: { title: 'Nothing waiting on you', description: 'Approvals and mentions show up here as they arrive.' },
  unread: { title: 'Nothing unread', description: 'New notifications will appear here.' },
}

export default function InboxPage() {
  const { notifications, unread } = useShared<{ notifications: Notification[]; unread: number }>()
  const [filter, setFilter] = useState<Filter>('all')
  const shown = notifications.filter((n) => filter === 'all' || n.read_at === null)

  const open = (n: Notification) => {
    if (n.read_at !== null) {
      router.visit(n.link)
      return
    }
    router.post(route('inbox.read'), { id: n.id }, { preserveScroll: true, onSuccess: () => router.visit(n.link) })
  }

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="Inbox"
        description={unread > 0 ? `${unread} unread ${unread === 1 ? 'notification' : 'notifications'}.` : 'You are all caught up.'}
        actions={
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <Button size="sm" onClick={() => router.post(route('inbox.read-all'), {}, { preserveScroll: true })}>
                Mark all read
              </Button>
            )}
            <SegmentedControl
              aria-label="Filter inbox"
              value={filter}
              onValueChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'unread', label: 'Unread' },
              ]}
            />
          </div>
        }
      />
      <Card>
        {shown.length === 0 ? (
          <EmptyState icon={CheckCheck} {...empty[filter]} />
        ) : (
          <ul>
            {shown.map((n) => {
              const Icon = icons[n.kind] ?? AtSign
              return (
                <li key={n.id} className="flex flex-wrap items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded bg-surface-2 text-fg-muted" title={kindLabels[n.kind]}>
                    <Icon size={16} aria-hidden />
                    <span className="sr-only">{kindLabels[n.kind]}</span>
                  </span>
                  <div className="min-w-0 flex-1 basis-64">
                    <a
                      href={n.link}
                      onClick={(e) => {
                        e.preventDefault()
                        open(n)
                      }}
                      className={`block text-base hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${n.read_at === null ? 'font-semibold' : 'font-medium'}`}
                    >
                      {n.title}
                    </a>
                    {n.body && <p className="line-clamp-2 text-sm text-fg-muted">{n.body}</p>}
                  </div>
                  <time className="shrink-0 text-sm text-fg-muted" dateTime={n.created_at}>
                    {relativeTime(n.created_at)}
                  </time>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
