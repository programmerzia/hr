import { Check, Circle, Pencil, Printer } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { Bars } from '../../components/charts/Bars'
import { HistoryPanel } from '../../components/shared/HistoryPanel'
import { MoneyCell } from '../../components/shared/MoneyCell'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Button, Card, CardBody, CardHeader, Dialog, Field, Input, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/format'
import { useAuthed } from '../../mock/session'
import { useBilling } from '../../mock/stores/billing'
import { usePeopleStore } from '../../mock/stores/people'
import type { ClaimStatus, ContractorClaim } from '../../types'
import { ClaimActions } from './ClaimActions'
import { COMPANY, hoursText, monthLabel } from './helpers'

const printCss = `@media print {
  body * { visibility: hidden; }
  .claim-print, .claim-print * { visibility: visible; }
  .claim-print { position: absolute; left: 0; top: 0; width: 100%; border: 0; box-shadow: none; }
}`

const steps: { status: ClaimStatus; label: string; verb: string }[] = [
  { status: 'draft', label: 'Draft', verb: 'generated' },
  { status: 'submitted', label: 'Submitted', verb: 'submitted' },
  { status: 'verified', label: 'Verified by lead', verb: 'verified' },
  { status: 'approved', label: 'Approved', verb: 'approved' },
  { status: 'paid', label: 'Paid', verb: 'paid' },
]

function EditDialog({ claim, onClose }: { claim: ContractorClaim; onClose: () => void }) {
  const updateClaim = useBilling((s) => s.updateClaim)
  const [hours, setHours] = useState((claim.claimed_minutes / 60).toFixed(2))
  const [fixed, setFixed] = useState(claim.fixed_amount === null ? '' : String(claim.fixed_amount))
  const [error, setError] = useState<string | undefined>()
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
            disabled={hours.trim() === '' && fixed.trim() === ''}
            onClick={() => {
              const res = updateClaim(claim.id, {
                claimed_minutes: Math.round((Number(hours) || 0) * 60),
                fixed_amount: fixed.trim() === '' ? null : Number(fixed),
              })
              if (!res.ok) return setError(res.error)
              onClose()
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

export function ClaimDetailPage() {
  const { id = '' } = useParams()
  const { employee, role } = useAuthed()
  const b = useBilling()
  const people = usePeopleStore()
  const [editing, setEditing] = useState(false)

  const claim = b.claimsVisibleTo({ employeeId: employee.id, role }).find((c) => c.id === id)
  if (!claim) {
    return (
      <div className="mx-auto max-w-content">
        <PageHeader title="Claim not found" breadcrumb={[{ label: 'Claims', to: '/claims' }]} />
        <p className="text-sm text-fg-muted">This claim does not exist or you do not have access to it.</p>
      </div>
    )
  }

  const contractor = people.employeeById(claim.employee_id)
  const bank = people.bankOf(claim.employee_id)
  const lead = people.leadOf(claim.employee_id)
  const weeks = b.weeklyBreakdown(claim.employee_id, claim.year, claim.month)
  // Claimed minutes are a monthly figure, so each week gets its share in proportion to tracked time.
  const ratio = claim.tracked_minutes > 0 ? claim.claimed_minutes / claim.tracked_minutes : 1
  const weekBars = weeks.map((w, i) => ({ label: `Wk ${i + 1}`, values: [w.minutes / 60, (w.minutes * ratio) / 60] }))
  const audit = b.auditFor('claim', claim.id)
  const nameOf = (eid: string) => people.employeeById(eid)?.name ?? eid
  const diff = claim.claimed_minutes - claim.tracked_minutes
  const period = monthLabel(claim.year, claim.month)
  const reached = steps.findIndex((s) => s.status === claim.status)
  const isOwnDraft = claim.employee_id === employee.id && claim.status === 'draft'

  const stepEntry = (verb: string) => [...audit].reverse().find((a) => a.text.includes(verb))
  const history = audit.map((a) => ({ at: a.at, actor: nameOf(a.actor_id), text: a.text }))

  return (
    <div className="mx-auto max-w-content">
      <style>{printCss}</style>
      <PageHeader
        title={`${period} claim`}
        description={contractor?.name}
        breadcrumb={[{ label: 'Claims', to: '/claims' }, { label: `${contractor?.name ?? ''} - ${period}` }]}
        actions={
          <>
            <StatusBadge status={claim.status} />
            <ClaimActions claim={claim} size="md" />
          </>
        }
        className="print:hidden"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_18rem]">
        <Card className="claim-print p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xl font-semibold">Contractor claim</p>
              <p className="text-sm text-fg-muted">{period}</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium">{COMPANY.name}</p>
              <p className="text-fg-muted">Claim for services</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-fg-muted">Contractor</p>
              <p className="mt-1 font-medium">{contractor?.name}</p>
              <p className="text-sm text-fg-muted">{contractor?.designation}</p>
              <p className="text-sm text-fg-muted">{contractor?.code}</p>
            </div>
            <div className="sm:justify-self-end">
              <p className="text-xs font-medium text-fg-muted">Pay to</p>
              {bank ? (
                <>
                  <p className="mt-1 font-medium">{bank.account_name}</p>
                  <p className="text-sm text-fg-muted">
                    {bank.bank}, {bank.branch}
                  </p>
                  <p className="font-mono text-sm text-fg-muted">Acct {bank.account_no}</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-fg-muted">No bank account on file.</p>
              )}
            </div>
          </div>

          {(
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border p-3">
                <p className="text-sm text-fg-muted">Tracked time</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{hoursText(claim.tracked_minutes)}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-sm text-fg-muted">Claimed hours</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{hoursText(claim.claimed_minutes)}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-sm text-fg-muted">Difference</p>
                <p className={cn('mt-1 font-mono text-lg font-semibold tabular-nums', diff > 0 ? 'text-warning' : 'text-fg')}>
                  {diff === 0 ? 'Matches' : `${diff > 0 ? '+' : '-'}${hoursText(Math.abs(diff))}`}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6">
            <h2 className="mb-2 text-base font-semibold">Tracked hours by week</h2>
            {weeks.length === 0 ? (
              <p className="text-sm text-fg-muted">No daily attendance is stored for this period. The total above is the figure recorded when the claim was generated.</p>
            ) : (
              <Table>
                <Thead>
                  <tr>
                    <Th>Week</Th>
                    <Th numeric>Days worked</Th>
                    <Th numeric>Hours</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {weeks.map((w) => (
                    <Tr key={w.label}>
                      <Td>{w.label}</Td>
                      <Td numeric>{w.days}</Td>
                      <Td numeric>{hoursText(w.minutes)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </div>

          <dl className="ml-auto mt-6 flex w-full max-w-xs flex-col gap-1.5 text-sm">
            {claim.fixed_amount === null ? (
              <>
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Rate</dt>
                  <dd>
                    <MoneyCell amount={claim.rate} currency="BDT" />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Hours claimed</dt>
                  <dd className="font-mono tabular-nums">{(claim.claimed_minutes / 60).toFixed(2)}</dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <dt className="text-fg-muted">Fixed monthly amount</dt>
                <dd>
                  <MoneyCell amount={claim.fixed_amount} currency="BDT" />
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>
                <MoneyCell amount={claim.total} currency="BDT" />
              </dd>
            </div>
          </dl>
        </Card>

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
                      {done ? <Check size={16} className="mt-0.5 text-success" aria-hidden /> : <Circle size={16} className="mt-0.5 text-fg-subtle" aria-hidden />}
                      <div>
                        <p className={done ? 'font-medium' : 'text-fg-muted'}>{s.label}</p>
                        {done && entry && (
                          <p className="text-xs text-fg-muted">
                            {nameOf(entry.actor_id)}, {formatDate(entry.at)}
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
              {isOwnDraft && (
                <Button icon={<Pencil size={14} />} onClick={() => setEditing(true)}>
                  Edit claim
                </Button>
              )}
              <Button icon={<Printer size={14} />} onClick={() => window.print()}>
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
