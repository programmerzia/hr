import { router } from '@inertiajs/react'
import { AtSign, CalendarDays, CheckCheck, ClipboardCheck, FileText, KeyRound, Receipt, Wallet, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Credentials } from '../../components/shared/Credentials'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button, Card, Dialog, EmptyState, SegmentedControl } from '../../components/ui'
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
  password_reset: KeyRound,
}

const kindLabels: Record<NotificationKind, string> = {
  leave: 'Leave',
  regularization: 'Regularization',
  claim: 'Claim',
  payroll: 'Payroll',
  invoice: 'Invoice',
  mention: 'Mention',
  password_reset: 'Password reset',
}

const empty: Record<Filter, { title: string; description: string }> = {
  all: { title: 'Nothing waiting on you', description: 'Approvals and mentions show up here as they arrive.' },
  unread: { title: 'Nothing unread', description: 'New notifications will appear here.' },
}

interface ResetRequest {
  id: string
  name: string
  email: string
  role: string
  requested_at: string
}

interface Creds {
  email: string
  temporary_password: string
}

export default function InboxPage() {
  const { notifications, unread, password_resets: resets, credentials } = useShared<{
    notifications: Notification[]
    unread: number
    password_resets: ResetRequest[]
    credentials: Creds | null
  }>()
  const [closed, setClosed] = useState(false)
  const [busy, setBusy] = useState(false)
  const approve = (id: string) =>
    router.post(route('people.password-resets.approve', id), {}, {
      preserveScroll: true,
      onStart: () => { setBusy(true); setClosed(false) },
      onFinish: () => setBusy(false),
    })
  const reject = (id: string) =>
    router.post(route('people.password-resets.reject', id), {}, { preserveScroll: true, onStart: () => setBusy(true), onFinish: () => setBusy(false) })
  const shownCreds = closed ? null : credentials
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
      {resets.length > 0 && (
        <Card className="mb-4">
          <ul>
            {resets.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded bg-surface-2 text-fg-muted">
                  <KeyRound size={16} aria-hidden />
                </span>
                <div className="min-w-0 flex-1 basis-64">
                  <p className="text-base font-medium">{r.name} asked for a password reset</p>
                  <p className="text-sm text-fg-muted">{r.email} · {relativeTime(r.requested_at)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => reject(r.id)}>Reject</Button>
                  <Button size="sm" variant="primary" disabled={busy} onClick={() => approve(r.id)}>Approve</Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Dialog
        open={shownCreds !== null}
        onOpenChange={(o) => { if (!o) setClosed(true) }}
        title="Password reset"
        description="Give these sign-in details to the person."
        footer={<Button variant="primary" onClick={() => setClosed(true)}>Done</Button>}
      >
        <div className="pb-2">
          {shownCreds && <Credentials email={shownCreds.email} password={shownCreds.temporary_password} />}
        </div>
      </Dialog>
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
