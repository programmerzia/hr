import { BadgeCheck, Check, Download, FileText, Flag, Pause, Play, RefreshCw, RotateCcw, Send, Trash2, Users } from 'lucide-react'
import { Link, router, useForm } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import { StackedBar } from '../../components/charts/StackedBar'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { HistoryPanel } from '../../components/shared/HistoryPanel'
import { MoneyCell } from '../../components/shared/MoneyCell'
import { PageHeader } from '../../components/shared/PageHeader'
import { PersonCell } from '../../components/shared/PersonCell'
import { StatusBadge } from '../../components/shared/StatusBadge'
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardBody,
  Dialog,
  Field,
  Input,
  NativeSelect,
  Sheet,
  Table,
  Tbody,
  Td,
  Textarea,
  Th,
  Thead,
  toast,
  Tr,
} from '../../components/ui'
import { formatDate, formatDuration, formatMoney } from '../../lib/format'
import { useAuth, useShared } from '../../inertia/props'
import type { PayrollAdjustment, PayrollAdjustmentKind, PayrollItem, PayrollPolicySwitches, PayrollRun } from '../../types'
import { deductionMix } from './charts'
import { act, failureOf, monthLabel, netAdjustment, runTitle, todayIso, type HistoryEvent, type PersonRef, type RunTotals } from './helpers'

interface RunDetailProps {
  run: PayrollRun
  items: PayrollItem[]
  adjustments: PayrollAdjustment[]
  totals: RunTotals
  mix: { label: string; value: number; color: string }[]
  events: HistoryEvent[]
  people: PersonRef[]
  policy: PayrollPolicySwitches
}

const days = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

/** Reason dialog shared by hold and reopen (both POST {reason}). */
function ReasonDialog({ open, onOpenChange, title, description, url, confirm }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; url: string; confirm: string }) {
  const form = useForm({ reason: '' })
  const errors = form.errors as Record<string, string>
  const submit = () => form.post(url, { preserveScroll: true, onSuccess: () => onOpenChange(false) })
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!form.data.reason.trim() || form.processing}>
            {confirm}
          </Button>
        </>
      }
    >
      <Field label="Reason" required error={errors.reason ?? errors.payroll ?? undefined}>
        <Textarea rows={3} value={form.data.reason} onChange={(e) => form.setData('reason', e.target.value)} />
      </Field>
    </Dialog>
  )
}

/** Flag badge for one item: up / down / new against the last paid month. */
function VarianceBadge({ item }: { item: PayrollItem }) {
  if (!item.variance_flag) return null
  const acked = Boolean(item.variance_ack_at)
  const text =
    item.variance_kind === 'new' ? 'New payee' : `${item.variance_kind === 'up' ? '+' : ''}${(item.variance_pct ?? 0).toFixed(1)}% vs last month`
  return (
    <Badge variant={acked ? 'neutral' : item.variance_kind === 'down' ? 'info' : 'warning'} title={acked ? 'Acknowledged' : 'Needs acknowledgement'}>
      {acked ? <BadgeCheck aria-hidden /> : <Flag aria-hidden />}
      {text}
    </Badge>
  )
}

const hours = (minutes: number) => formatDuration(minutes * 60)

function MarkPaidDialog({ open, onOpenChange, runId, label }: { open: boolean; onOpenChange: (o: boolean) => void; runId: string; label: string }) {
  const form = useForm({ paid_on: todayIso(), reference: '' })
  const errors = form.errors as Record<string, string>

  const submit = () => form.post(route('payroll.runs.pay', runId), { preserveScroll: true, onSuccess: () => onOpenChange(false) })

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Mark ${label} as paid`}
      description="Record when salaries were disbursed. Payslips become visible to employees."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!form.data.paid_on || form.processing}>
            Mark as paid
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Disbursement date" required error={errors.paid_on}>
          <Input type="date" value={form.data.paid_on} onChange={(e) => form.setData('paid_on', e.target.value)} />
        </Field>
        <Field label="Bank reference" required error={errors.reference ?? errors.payroll ?? undefined} hint="Batch or transfer reference from the bank.">
          <Input value={form.data.reference} onChange={(e) => form.setData('reference', e.target.value)} placeholder="BEFTN-202611-001" />
        </Field>
      </div>
    </Dialog>
  )
}

function ItemSheet({
  item,
  run,
  adjustments,
  name,
  onClose,
}: {
  item: PayrollItem | null
  run: PayrollRun
  adjustments: PayrollAdjustment[]
  name?: string
  onClose: () => void
}) {
  const form = useForm<{ kind: PayrollAdjustmentKind; label: string; amount: string; note: string }>({ kind: 'bonus', label: '', amount: '', note: '' })
  const error = (form.errors as Record<string, string>).payroll
  const locked = run.status !== 'draft' && run.status !== 'review'

  const add = () => {
    if (!item) return
    form.post(route('payroll.adjustments.store', item.id), { preserveScroll: true, onSuccess: () => {
        form.reset('label', 'amount', 'note')
        onClose()
      },
    })
  }

  const line = (name: string, value: number, sign: '' | '+' | '-' = '', strong = false) => (
    <div className={`flex items-center justify-between py-1.5 text-sm ${strong ? 'font-semibold' : ''}`}>
      <span className={strong ? '' : 'text-fg-muted'}>{name}</span>
      <span className="font-mono tabular-nums">
        {sign}
        {formatMoney(value)}
      </span>
    </div>
  )

  return (
    <Sheet
      open={Boolean(item)}
      onOpenChange={(o) => !o && onClose()}
      title={name ?? 'Payroll item'}
      description={`${runTitle(run)} breakdown`}
      footer={
        item ? (
          <Link href={route('payroll.payslip', item.id)} className={buttonVariants({ variant: 'secondary' })}>
            <FileText size={16} aria-hidden /> View payslip
          </Link>
        ) : undefined
      }
    >
      {item && (
        <div className="flex flex-col gap-5 p-4">
          {run.kind !== 'festival' && (
          <section>
            <h3 className="mb-1 text-sm font-semibold">Attendance</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p><span className="text-fg-muted">Worked </span>{hours(item.worked_minutes)}</p>
              <p><span className="text-fg-muted">Standard </span>{hours(item.standard_minutes)}</p>
              <p><span className="text-fg-muted">Overtime </span>{hours(item.overtime_minutes)}</p>
              <p><span className="text-fg-muted">Unpaid leave </span>{item.unpaid_leave_days} days</p>
              <p><span className="text-fg-muted">Late arrivals </span>{item.late_count}</p>
              <p><span className="text-fg-muted">Eligible days </span>{days(item.eligible_days)}</p>
              <p><span className="text-fg-muted">Absent </span>{days(item.absent_days)}</p>
              <p><span className="text-fg-muted">Half days </span>{days(item.half_days)}</p>
              <p><span className="text-fg-muted">Paid leave </span>{days(item.paid_leave_days)}</p>
            </div>
            {item.hold && <p className="mt-2 text-sm text-warning">On hold: {item.hold_reason}</p>}
          </section>
          )}

          {item.variance_flag && (
            <section>
              <VarianceBadge item={item} />
            </section>
          )}

          {run.kind !== 'festival' && (item.slices.length > 0 || item.components) && (
            <section>
              <h3 className="mb-1 text-sm font-semibold">Salary basis</h3>
              {item.slices.map((sl) => (
                <div key={sl.effective_from} className="flex justify-between py-1 text-sm">
                  <span className="text-fg-muted">
                    From {formatDate(sl.effective_from)}, {days(sl.days)} days of {formatMoney(sl.gross)}
                  </span>
                  <span className="font-mono tabular-nums">{formatMoney(sl.gross_share)}</span>
                </div>
              ))}
              {item.components && (
                <div className="mt-2 grid grid-cols-2 gap-x-4 text-sm">
                  {(
                    [
                      ['Basic', item.components.basic],
                      ['House rent', item.components.house_rent],
                      ['Medical', item.components.medical],
                      ['Conveyance', item.components.conveyance],
                      ...item.components.other_allowances.map((o) => [o.label, o.amount] as const),
                    ] as [string, number][]
                  ).map(([k, v]) => (
                    <p key={k} className="flex justify-between py-0.5">
                      <span className="text-fg-muted">{k}</span>
                      <span className="font-mono tabular-nums">{formatMoney(v)}</span>
                    </p>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="divide-y divide-border">
            {line(run.kind === 'festival' ? (run.label ?? 'Festival bonus') : 'Gross salary', item.gross)}
            {item.leave_encashment > 0 && line(`Leave encashment (${days(item.components?.encashment_days ?? 0)} days)`, item.leave_encashment, '+')}
            {item.overtime_pay > 0 && line('Overtime pay', item.overtime_pay, '+')}
            {adjustments.filter((a) => a.kind === 'bonus').length > 0 && line('Bonuses', adjustments.filter((a) => a.kind === 'bonus').reduce((t, a) => t + a.amount, 0), '+')}
            {item.unpaid_deduction > 0 && line(`Loss of pay (${days(item.lop_days)} days)`, item.unpaid_deduction, '-')}
            {item.late_deduction > 0 && line(`Late penalty (${days(item.late_penalty_days)} days)`, item.late_deduction, '-')}
            {item.tax > 0 && line('Income tax', item.tax, '-')}
            {item.pf > 0 && line('Provident fund', item.pf, '-')}
            {adjustments.filter((a) => a.kind === 'deduction').length > 0 && line('Other deductions', adjustments.filter((a) => a.kind === 'deduction').reduce((t, a) => t + a.amount, 0), '-')}
            {line('Net pay', item.net, '', true)}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Adjustments</h3>
            {adjustments.length === 0 ? (
              <p className="text-sm text-fg-muted">No adjustments for this month.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {adjustments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.label}</p>
                      <p className="truncate text-xs text-fg-muted">
                        {a.kind === 'bonus' ? 'Bonus' : 'Deduction'}
                        {a.note ? `, ${a.note}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono tabular-nums ${a.kind === 'deduction' ? 'text-danger' : ''}`}>
                        {a.kind === 'deduction' ? '-' : '+'}
                        {formatMoney(a.amount)}
                      </span>
                      {!locked && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Remove ${a.label}`}
                          icon={<Trash2 size={14} />}
                          onClick={() =>
                            router.delete(route('payroll.adjustments.destroy', a.id), {
                              preserveScroll: true,
                              onSuccess: onClose,
                              onError: (e) => toast.error(failureOf(e)),
                            })
                          }
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {locked ? (
              <p className="mt-2 text-xs text-fg-muted">This run is locked, so adjustments can't change.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-3 rounded-md border border-border p-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Type">
                    <NativeSelect value={form.data.kind} onChange={(e) => form.setData('kind', e.target.value as PayrollAdjustmentKind)}>
                      <option value="bonus">Bonus</option>
                      <option value="deduction">Deduction</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Amount (BDT)">
                    <Input type="number" min={0} value={form.data.amount} onChange={(e) => form.setData('amount', e.target.value)} />
                  </Field>
                </div>
                <Field label="Label">
                  <Input value={form.data.label} onChange={(e) => form.setData('label', e.target.value)} placeholder="Project delivery bonus" />
                </Field>
                <Field label="Note" error={error || undefined}>
                  <Textarea rows={2} value={form.data.note} onChange={(e) => form.setData('note', e.target.value)} />
                </Field>
                <div className="flex justify-end">
                  <Button variant="primary" onClick={add} disabled={!form.data.label.trim() || !(Number(form.data.amount) > 0) || form.processing}>
                    Add adjustment
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </Sheet>
  )
}

export default function RunDetailPage() {
  const { role } = useAuth()
  const { run, items: rawItems, adjustments, totals, mix: rawMix, events, people, policy } = useShared<RunDetailProps>()
  const mix = useMemo(() => deductionMix(rawMix), [rawMix])
  const person = (id: string) => people.find((p) => p.id === id)

  const [selected, setSelected] = useState<string | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [reopenOpen, setReopenOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [holdId, setHoldId] = useState<string | null>(null)

  const items = rawItems
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const festival = run.kind === 'festival'
  const settlement = run.kind === 'settlement'
  const showEncash = settlement
  const showPf = !festival && (policy.pf_enabled || items.some((i) => i.pf > 0))
  const showLop = !festival && (policy.lop_enabled || items.some((i) => i.unpaid_deduction > 0))
  const showLate = !festival && (policy.late_penalty_enabled || items.some((i) => i.late_deduction > 0))
  const showOt = !festival && (policy.overtime_enabled || items.some((i) => i.overtime_pay > 0))
  const live = items.filter((i) => !i.hold)
  const overtimeTotal = live.reduce((t, i) => t + i.overtime_pay, 0)
  const employerCost = totals.gross + (totals.pf_employer ?? 0) + overtimeTotal + (totals.encashment ?? 0)
  const flagged = items.filter((i) => i.variance_flag && !i.hold)
  const pendingFlags = flagged.filter((i) => !i.variance_ack_at).length
  const shown = flaggedOnly ? items.filter((i) => i.variance_flag) : items
  const canManage = role === 'hr' || role === 'management'
  const history = useMemo(
    () => events.map((e) => ({ at: e.created_at, actor: (e.actor_id && person(e.actor_id)?.name) || 'Someone', text: e.description })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, people],
  )
  const selectedItem = items.find((i) => i.id === selected) ?? null

  const label = runTitle(run, person(run.employee_id ?? '')?.name)
  const open = run.status === 'draft' || run.status === 'review'
  const actions = (
    <>
      {open && (
        <Button
          icon={<RefreshCw size={16} />}
          onClick={() => act(route('payroll.runs.recompute', run.id))}
        >
          Recompute
        </Button>
      )}
      {run.status === 'draft' && (
        <Button variant="primary" icon={<Send size={16} />} onClick={() => act(route('payroll.runs.submit', run.id))}>
          Send for review
        </Button>
      )}
      {run.status === 'draft' && canManage && (
        <Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => setDiscardOpen(true)}>
          Discard draft
        </Button>
      )}
      {run.status === 'review' && role === 'management' && (
        <Button variant="primary" icon={<Check size={16} />} onClick={() => setApproveOpen(true)}>
          Approve
        </Button>
      )}
      {run.status === 'approved' && role === 'management' && !settlement && (
        <Button icon={<RotateCcw size={16} />} onClick={() => setReopenOpen(true)}>
          Reopen
        </Button>
      )}
      {(run.status === 'approved' || run.status === 'paid') && (
        <a href={route('payroll.runs.bank-advice', run.id)} className={buttonVariants({ variant: 'secondary' })}>
          <Download size={16} aria-hidden /> Bank advice
        </a>
      )}
      {run.status === 'approved' && (
        <Button variant="primary" onClick={() => setPayOpen(true)}>
          Mark as paid
        </Button>
      )}
    </>
  )

  const adjFor = (id: string) => netAdjustment(adjustments.filter((a) => a.item_id === id))

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title={label}
        breadcrumb={[{ label: 'Payroll', to: '/payroll' }, { label }]}
        description={
          run.status === 'draft' && festival
            ? `${run.bonus_percent_of_basic ?? 0}% of basic for ${monthLabel(run.year, run.month)}. No loss of pay, PF or tax applies.`
            : run.status === 'draft' && settlement
              ? `Prorated salary to the exit date plus unused leave. Add asset deductions as adjustments. ${monthLabel(run.year, run.month)}.`
              : run.status === 'approved' && settlement
                ? 'Approved and locked. Leave has been encashed, so a settlement run cannot be reopened.'
                : run.status === 'review' && role !== 'management'
            ? 'Waiting for management to approve.'
            : run.status === 'paid' && run.paid_at
              ? `Paid on ${formatDate(run.paid_at)}, reference ${run.payment_reference ?? '-'}`
              : run.status === 'approved'
                ? 'Approved and locked. Mark as paid once the bank transfer is done.'
                : undefined
        }
        actions={
          <>
            {run.kind && run.kind !== 'regular' && <Badge variant="info">{festival ? 'Festival bonus' : 'Final settlement'}</Badge>}
            <StatusBadge status={run.status} />
            {actions}
          </>
        }
      />

      <Card className="mb-4">
        <CardBody className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-5">
            {[
              { label: 'Employees', value: String(totals.employees) },
              { label: 'Gross', value: formatMoney(totals.gross) },
              { label: 'Deductions', value: formatMoney(totals.deductions) },
              { label: 'Net payable', value: formatMoney(totals.net), strong: true },
              { label: 'Employer cost', value: formatMoney(employerCost) },
            ].map((f) => (
              <div key={f.label}>
                <dt className="text-sm text-fg-muted">{f.label}</dt>
                <dd className={`mt-1 font-mono tabular-nums ${f.strong ? 'text-xl font-semibold' : 'text-xl font-medium'}`}>{f.value}</dd>
              </div>
            ))}
          </dl>
          {run.status === 'review' && pendingFlags > 0 && (
            <p className="text-sm text-warning">{pendingFlags} flagged for a large change since last month. HR must acknowledge each before approval.</p>
          )}
          {(totals.held ?? 0) > 0 && <p className="text-sm text-warning">{totals.held} on hold, not included in the totals or the bank advice.</p>}
          {mix.some((m) => m.value > 0) && (
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-sm text-fg-muted">Deductions by type</p>
              <StackedBar segments={mix} height={8} aria-label="Deductions by type" />
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          {flagged.length > 0 && (
            <div className="mb-2 flex items-center justify-end">
              <Button size="sm" variant={flaggedOnly ? 'primary' : 'secondary'} icon={<Flag size={14} />} onClick={() => setFlaggedOnly((v) => !v)} aria-pressed={flaggedOnly}>
                Flagged only ({flagged.length})
              </Button>
            </div>
          )}
          {items.length === 0 ? (
            <EmptyTable icon={Users} title="No employees in this run" description="Full-time employees with a salary structure appear after you recompute." />
          ) : (
            <Table>
              <Thead>
                <Tr className="hover:bg-transparent">
                  <Th>Employee</Th>
                  {!festival && <Th numeric>Days</Th>}
                  {!festival && <Th numeric>Absent / half</Th>}
                  {!festival && <Th numeric>Paid / unpaid leave</Th>}
                  <Th numeric>{festival ? 'Bonus' : 'Gross'}</Th>
                  {showEncash && <Th numeric>Leave encashment</Th>}
                  {showOt && <Th numeric>Overtime</Th>}
                  {showLop && <Th numeric>LOP</Th>}
                  {showLate && <Th numeric>Late penalty</Th>}
                  {showPf && <Th numeric>PF</Th>}
                  <Th numeric>Adjustments</Th>
                  <Th numeric>Deductions</Th>
                  <Th numeric>Net</Th>
                  {canManage && open && <Th>Hold</Th>}
                </Tr>
              </Thead>
              <Tbody>
                {shown.map((i) => {
                  const emp = person(i.employee_id)
                  const adj = adjFor(i.id)
                  return (
                    <Tr
                      key={i.id}
                      className={`cursor-pointer ${i.hold ? 'opacity-60' : ''}`}
                      tabIndex={0}
                      onClick={() => setSelected(i.id)}
                      onKeyDown={(e) => e.key === 'Enter' && setSelected(i.id)}
                    >
                      <Td>
                        <PersonCell name={emp?.name ?? i.employee_id} subtitle={emp?.code} />
                        {i.variance_flag && !i.hold && (
                          <div className="mt-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <VarianceBadge item={i} />
                            {run.status === 'review' && canManage && !i.variance_ack_at && (
                              <Button size="sm" variant="secondary" onClick={() => act(route('payroll.items.ack-variance', i.id))}>
                                Acknowledge
                              </Button>
                            )}
                          </div>
                        )}
                      </Td>
                      {!festival && <Td numeric>{days(i.eligible_days)}</Td>}
                      {!festival && (
                        <Td numeric className="whitespace-nowrap">
                          {days(i.absent_days)} / {days(i.half_days)}
                        </Td>
                      )}
                      {!festival && (
                        <Td numeric className="whitespace-nowrap">
                          {days(i.paid_leave_days)} / {days(i.unpaid_leave_days)}
                        </Td>
                      )}
                      <Td>
                        <MoneyCell amount={i.gross} />
                      </Td>
                      {showEncash && (
                        <Td>
                          <MoneyCell amount={i.leave_encashment} />
                        </Td>
                      )}
                      {showOt && (
                        <Td>
                          <MoneyCell amount={i.overtime_pay} />
                        </Td>
                      )}
                      {showLop && (
                        <Td>
                          <MoneyCell amount={i.unpaid_deduction} />
                        </Td>
                      )}
                      {showLate && (
                        <Td>
                          <MoneyCell amount={i.late_deduction} />
                        </Td>
                      )}
                      {showPf && (
                        <Td>
                          <MoneyCell amount={i.pf} />
                        </Td>
                      )}
                      <Td>
                        <MoneyCell amount={adj} className={adj > 0 ? 'text-success' : undefined} />
                      </Td>
                      <Td>
                        <MoneyCell amount={i.unpaid_deduction + i.late_deduction + i.tax + i.pf} />
                      </Td>
                      <Td>
                        <MoneyCell amount={i.net} className="font-semibold" />
                      </Td>
                      {canManage && open && (
                        <Td onClick={(e) => e.stopPropagation()}>
                          {i.hold ? (
                            <Button size="sm" variant="ghost" icon={<Play size={14} />} title={i.hold_reason ?? undefined} onClick={() => act(route('payroll.items.unhold', i.id))}>
                              Release
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" icon={<Pause size={14} />} onClick={() => setHoldId(i.id)}>
                              Hold
                            </Button>
                          )}
                        </Td>
                      )}
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          )}
        </div>
        <HistoryPanel entries={history} title="Run history" />
      </div>

      <ItemSheet
        item={selectedItem}
        run={run}
        adjustments={adjustments.filter((a) => a.item_id === selected)}
        name={selectedItem ? person(selectedItem.employee_id)?.name : undefined}
        onClose={() => setSelected(null)}
      />
      <ReasonDialog
        key={`hold-${holdId ?? ''}`}
        open={holdId !== null}
        onOpenChange={(o) => !o && setHoldId(null)}
        title="Hold salary"
        description="A held salary is left out of the run totals and the bank advice."
        url={holdId ? route('payroll.items.hold', holdId) : ''}
        confirm="Hold"
      />
      <ReasonDialog
        key={`reopen-${String(reopenOpen)}`}
        open={reopenOpen}
        onOpenChange={setReopenOpen}
        title={`Reopen ${label}`}
        description="The run goes back to review and can be recomputed or adjusted before approving again."
        url={route('payroll.runs.reopen', run.id)}
        confirm="Reopen"
      />
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={`Discard ${label}`}
        description="Deletes this draft run and its adjustments. Nothing has been paid; you can start the month again later."
        confirmLabel="Discard draft"
        onConfirm={() => {
          setDiscardOpen(false)
          router.delete(route('payroll.runs.destroy', run.id))
        }}
      />
      <MarkPaidDialog key={String(payOpen)} open={payOpen} onOpenChange={setPayOpen} runId={run.id} label={label} />
      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title={`Approve ${label}`}
        description={`Approving locks the run. ${totals.employees} employees, net payable ${formatMoney(totals.net)}.`}
        confirmLabel="Approve and lock"
        onConfirm={() => {
          setApproveOpen(false)
          act(route('payroll.runs.approve', run.id))
        }}
      />
    </div>
  )
}
