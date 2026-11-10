import { AtSign, CalendarDays, CheckCheck, ClipboardCheck, Receipt, Wallet, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '../../components/shared/PageHeader'
import { PersonCell } from '../../components/shared/PersonCell'
import { Button, Card, Dialog, EmptyState, Field, SegmentedControl, Textarea } from '../../components/ui'
import { relativeTime } from '../../lib/format'
import { isApprovalKind, useInboxItems, type InboxAction, type InboxItem, type InboxKind } from '../../mock/stores/inbox'

type Filter = 'all' | 'approvals' | 'mentions'

const icons: Record<InboxKind, LucideIcon> = {
  leave: CalendarDays,
  regularization: ClipboardCheck,
  claim: Receipt,
  payroll: Wallet,
  mention: AtSign,
}

const kindLabels: Record<InboxKind, string> = {
  leave: 'Leave',
  regularization: 'Regularization',
  claim: 'Claim',
  payroll: 'Payroll',
  mention: 'Mention',
}

const empty: Record<Filter, { title: string; description: string }> = {
  all: { title: 'Nothing waiting on you', description: 'Approvals and mentions show up here as they arrive.' },
  approvals: { title: 'No approvals pending', description: 'Leave, regularization and other requests will appear here.' },
  mentions: { title: 'No recent mentions', description: 'Messages that mention you in the last 7 days will appear here.' },
}

export function InboxPage() {
  const items = useInboxItems()
  const [filter, setFilter] = useState<Filter>('all')
  const [rejecting, setRejecting] = useState<{ item: InboxItem; action: InboxAction } | null>(null)
  const [note, setNote] = useState('')

  const shown = items.filter((i) =>
    filter === 'all' ? true : filter === 'approvals' ? isApprovalKind(i.kind) : i.kind === 'mention',
  )
  const approvals = items.filter((i) => isApprovalKind(i.kind)).length

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="Inbox"
        description={approvals > 0 ? `${approvals} ${approvals === 1 ? 'item needs' : 'items need'} your decision.` : 'You are all caught up.'}
        actions={
          <SegmentedControl
            aria-label="Filter inbox"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'approvals', label: 'Approvals' },
              { value: 'mentions', label: 'Mentions' },
            ]}
          />
        }
      />
      <Card>
        {shown.length === 0 ? (
          <EmptyState icon={CheckCheck} {...empty[filter]} />
        ) : (
          <ul>
            {shown.map((item) => {
              const Icon = icons[item.kind]
              return (
                <li key={item.id} className="flex flex-wrap items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded bg-surface-2 text-fg-muted" title={kindLabels[item.kind]}>
                    <Icon size={16} aria-hidden />
                    <span className="sr-only">{kindLabels[item.kind]}</span>
                  </span>
                  <div className="min-w-0 flex-1 basis-64">
                    {item.person && <PersonCell name={item.person} className="mb-0.5" />}
                    <Link to={item.href} className="block text-base font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                      {item.title}
                    </Link>
                    <p className="line-clamp-2 text-sm text-fg-muted">{item.subtitle}</p>
                  </div>
                  <time className="shrink-0 text-sm text-fg-muted" dateTime={item.at}>
                    {relativeTime(item.at)}
                  </time>
                  {item.actions && (
                    <div className="flex shrink-0 gap-2">
                      {item.actions.map((a) =>
                        a.tone === 'approve' ? (
                          <Button key={a.label} size="sm" variant="primary" onClick={() => a.run()}>
                            {a.label}
                          </Button>
                        ) : (
                          <Button
                            key={a.label}
                            size="sm"
                            onClick={() => {
                              setNote('')
                              setRejecting({ item, action: a })
                            }}
                          >
                            {a.label}
                          </Button>
                        ),
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Dialog
        open={rejecting !== null}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="Reject request"
        description={rejecting?.item.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!note.trim()}
              onClick={() => {
                rejecting?.action.run(note.trim())
                setRejecting(null)
              }}
            >
              Reject
            </Button>
          </>
        }
      >
        <Field label="Note for the requester" required>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Why is this being rejected?" />
        </Field>
      </Dialog>
    </div>
  )
}
