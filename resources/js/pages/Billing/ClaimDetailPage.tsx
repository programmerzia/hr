import { router, useForm } from '@inertiajs/react'
import { Check, Circle, Pencil, Printer } from 'lucide-react'
import { useState } from 'react'
import { Bars } from '../../components/charts/Bars'
import { HistoryPanel } from '../../components/shared/HistoryPanel'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Button, Card, CardBody, CardHeader, Dialog, Field, Input } from '../../components/ui'
import { useShared } from '../../inertia/props'
import { formatDate } from '../../lib/format'
import type { ClaimStatus, ContractorClaim } from '../../types'
import { ClaimActions, type ClaimAction } from './ClaimActions'
import { ClaimSheet, type ClaimDetailProps } from './ClaimSheet'
import { errorText, hoursText, monthLabel } from './helpers'

const steps: { status: ClaimStatus; label: string; verb: string }[] = [
  { status: 'draft', label: 'Draft', verb: 'generated' },
  { status: 'submitted', label: 'Submitted', verb: 'submitted' },
  { status: 'verified', label: 'Verified by lead', verb: 'verified' },
  { status: 'approved', label: 'Approved', verb: 'approved' },
  { status: 'paid', label: 'Paid', verb: 'paid' },
]

function EditDialog({ claim, onClose }: { claim: ContractorClaim; onClose: () => void }) {
  const [hours, setHours] = useState((claim.claimed_minutes / 60).toFixed(2))
  const [fixed, setFixed] = useState(claim.fixed_amount === null ? '' : String(claim.fixed_amount))
  const form = useForm<{
    claimed_minutes: number
    fixed_amount: number | null
  }>({
    claimed_minutes: claim.claimed_minutes,
    fixed_amount: claim.fixed_amount,
  })
  const error = errorText(form.errors as Record<string, string>)
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Edit claim"
      description="Adjust the hours you are claiming, or set a fixed monthly amount."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={(hours.trim() === '' && fixed.trim() === '') || form.processing}
            onClick={() => {
              form.transform(() => ({
                claimed_minutes: Math.round((Number(hours) || 0) * 60),
                fixed_amount: fixed.trim() === '' ? null : Math.round(Number(fixed)),
              }))
              form.patch(route('billing.claims.update', claim.id), { preserveScroll: true, onSuccess: onClose })
            }}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <Field label="Claimed hours" hint={`Tracked time is ${hoursText(claim.tracked_minutes)}.`} error={error}>
          <Input type="number" min={0} step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} />
        </Field>
        <Field label="Fixed monthly amount (BDT)" hint="Leave empty to bill hours × rate.">
          <Input type="number" min={0} value={fixed} onChange={(e) => setFixed(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}

export default function ClaimDetailPage() {
  const { claim, employee, lead, bank, weeks, audit, action, can_edit } = useShared<
    ClaimDetailProps & { action: ClaimAction | null; can_edit: boolean }
  >()
  const [editing, setEditing] = useState(false)

  // Claimed minutes are a monthly figure, so each week gets its share in proportion to tracked time.
  const ratio = claim.tracked_minutes > 0 ? claim.claimed_minutes / claim.tracked_minutes : 1
  const weekBars = weeks.map((w, i) => ({
    label: `Wk ${i + 1}`,
    values: [w.minutes / 60, (w.minutes * ratio) / 60],
  }))
  const period = monthLabel(claim.year, claim.month)
  const reached = steps.findIndex((s) => s.status === claim.status)

  // Audit comes newest first; the earliest entry matching a step's verb is when that step happened.
  const stepEntry = (verb: string) => [...audit].reverse().find((a) => a.text.includes(verb))
  const history = audit.map((a) => ({
    at: a.at,
    actor: a.actor,
    text: a.text,
  }))

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title={`${period} claim`}
        description={employee.name}
        breadcrumb={[{ label: 'Claims', to: '/claims' }, { label: `${employee.name} - ${period}` }]}
        actions={
          <>
            <StatusBadge status={claim.status} />
            <ClaimActions claim={claim} action={action} size="md" />
          </>
        }
        className="print:hidden"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_18rem]">
        <ClaimSheet claim={claim} employee={employee} bank={bank} weeks={weeks} />

        <div className="flex flex-col gap-4 print:hidden">
          <Card>
            <CardHeader title="Progress" />
            <CardBody>
              <ol className="flex flex-col gap-3">
                {steps.map((s, i) => {
                  const done = i <= reached
                  const entry = i === 0 ? stepEntry('generated') : stepEntry(s.verb)
                  return (
                    <li key={s.status} className="flex items-start gap-2 text-sm">
                      {done ? (
                        <Check size={16} className="mt-0.5 text-success" aria-hidden />
                      ) : (
                        <Circle size={16} className="mt-0.5 text-fg-subtle" aria-hidden />
                      )}
                      <div>
                        <p className={done ? 'font-medium' : 'text-fg-muted'}>{s.label}</p>
                        {done && entry && (
                          <p className="text-xs text-fg-muted">
                            {entry.actor}, {formatDate(entry.at)}
                          </p>
                        )}
                        {i === 2 && !done && lead && <p className="text-xs text-fg-subtle">Waiting for {lead.name}</p>}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </CardBody>
          </Card>
          {weekBars.length > 0 && (
            <Card>
              <CardHeader title="Hours by week" />
              <CardBody>
                <Bars
                  data={weekBars}
                  series={[{ name: 'Tracked' }, { name: 'Claimed', color: 'chart-2' }]}
                  height={96}
                  format={(v) => hoursText(Math.round(v * 60))}
                  aria-label={`Tracked and claimed hours for each week of ${period}`}
                />
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Actions" />
            <CardBody className="flex flex-col gap-2">
              {can_edit && (
                <Button icon={<Pencil size={14} />} onClick={() => setEditing(true)}>
                  Edit claim
                </Button>
              )}
              <Button icon={<Printer size={14} />} onClick={() => router.get(route('billing.claims.print', claim.id))}>
                Print
              </Button>
            </CardBody>
          </Card>
          <HistoryPanel entries={history} />
        </div>
      </div>
      {editing && <EditDialog claim={claim} onClose={() => setEditing(false)} />}
    </div>
  )
}
