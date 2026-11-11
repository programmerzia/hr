import { Check, FileText, RefreshCw, Send, Trash2, Users } from 'lucide-react'
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
import type { PayrollAdjustment, PayrollAdjustmentKind, PayrollItem, PayrollRun } from '../../types'
import { deductionMix } from './charts'
import { act, failureOf, monthLabel, netAdjustment, todayIso, type HistoryEvent, type PersonRef, type RunTotals } from './helpers'

interface RunDetailProps {
  run: PayrollRun
  items: PayrollItem[]
  adjustments: PayrollAdjustment[]
  totals: RunTotals
  mix: { label: string; value: number; color: string }[]
  events: HistoryEvent[]
  people: PersonRef[]
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
    form.post(route('payroll.adjustments.store', item.id), { preserveScroll: true, onSuccess: () => form.reset('label', 'amount', 'note') })
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
      description={`${monthLabel(run.year, run.month)} breakdown`}
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
          <section>
            <h3 className="mb-1 text-sm font-semibold">Attendance</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p><span className="text-fg-muted">Worked </span>{hours(item.worked_minutes)}</p>
              <p><span className="text-fg-muted">Standard </span>{hours(item.standard_minutes)}</p>
              <p><span className="text-fg-muted">Overtime </span>{hours(item.overtime_minutes)}</p>
              <p><span className="text-fg-muted">Unpaid leave </span>{item.unpaid_leave_days} days</p>
              <p><span className="text-fg-muted">Late arrivals </span>{item.late_count}</p>
            </div>
          </section>

          <section className="divide-y divide-border">
            {line('Gross salary', item.gross)}
            {item.overtime_pay > 0 && line('Overtime pay', item.overtime_pay, '+')}
            {adjustments.filter((a) => a.kind === 'bonus').length > 0 && line('Bonuses', adjustments.filter((a) => a.kind === 'bonus').reduce((t, a) => t + a.amount, 0), '+')}
            {line('Unpaid leave', item.unpaid_deduction, '-')}
            {line('Late arrival penalty', item.late_deduction, '-')}
            {line('Income tax', item.tax, '-')}
            {line('Provident fund', item.pf, '-')}
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
  const { run, items: rawItems, adjustments, totals, mix: rawMix, events, people } = useShared<RunDetailProps>()
  const mix = useMemo(() => deductionMix(rawMix), [rawMix])
  const person = (id: string) => people.find((p) => p.id === id)

  const [selected, setSelected] = useState<string | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)

  const items = rawItems
  const history = useMemo(
    () => events.map((e) => ({ at: e.created_at, actor: (e.actor_id && person(e.actor_id)?.name) || 'Someone', text: e.description })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, people],
  )
  const selectedItem = items.find((i) => i.id === selected) ?? null

  const label = monthLabel(run.year, run.month)
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
      {run.status === 'review' && role === 'management' && (
        <Button variant="primary" icon={<Check size={16} />} onClick={() => setApproveOpen(true)}>
          Approve
        </Button>
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
          run.status === 'review' && role !== 'management'
            ? 'Waiting for management to approve.'
            : run.status === 'paid' && run.paid_at
              ? `Paid on ${formatDate(run.paid_at)}, reference ${run.payment_reference ?? '-'}`
              : run.status === 'approved'
                ? 'Approved and locked. Mark as paid once the bank transfer is done.'
                : undefined
        }
        actions={
          <>
            <StatusBadge status={run.status} />
            {actions}
          </>
        }
      />

      <Card className="mb-4">
        <CardBody className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
            {[
              { label: 'Employees', value: String(totals.employees) },
              { label: 'Gross', value: formatMoney(totals.gross) },
              { label: 'Deductions', value: formatMoney(totals.deductions) },
              { label: 'Net payable', value: formatMoney(totals.net), strong: true },
            ].map((f) => (
              <div key={f.label}>
                <dt className="text-sm text-fg-muted">{f.label}</dt>
                <dd className={`mt-1 font-mono tabular-nums ${f.strong ? 'text-xl font-semibold' : 'text-xl font-medium'}`}>{f.value}</dd>
              </div>
            ))}
          </dl>
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
          {items.length === 0 ? (
            <EmptyTable icon={Users} title="No employees in this run" description="Full-time employees with a salary structure appear after you recompute." />
          ) : (
            <Table>
              <Thead>
                <Tr className="hover:bg-transparent">
                  <Th>Employee</Th>
                  <Th numeric>Worked / standard</Th>
                  <Th numeric>Late</Th>
                  <Th numeric>Unpaid days</Th>
                  <Th numeric>Gross</Th>
                  <Th numeric>Adjustments</Th>
                  <Th numeric>Deductions</Th>
                  <Th numeric>Net</Th>
                </Tr>
              </Thead>
              <Tbody>
                {items.map((i) => {
                  const emp = person(i.employee_id)
                  const adj = adjFor(i.id)
                  return (
                    <Tr
                      key={i.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => setSelected(i.id)}
                      onKeyDown={(e) => e.key === 'Enter' && setSelected(i.id)}
                    >
                      <Td>
                        <PersonCell name={emp?.name ?? i.employee_id} subtitle={emp?.code} />
                      </Td>
                      <Td numeric className="whitespace-nowrap">
                        {hours(i.worked_minutes)} / {hours(i.standard_minutes)}
                      </Td>
                      <Td numeric>{i.late_count}</Td>
                      <Td numeric>{i.unpaid_leave_days}</Td>
                      <Td>
                        <MoneyCell amount={i.gross} />
                      </Td>
                      <Td>
                        <MoneyCell amount={adj} className={adj > 0 ? 'text-success' : undefined} />
                      </Td>
                      <Td>
                        <MoneyCell amount={i.unpaid_deduction + i.late_deduction + i.tax + i.pf} />
                      </Td>
                      <Td>
                        <MoneyCell amount={i.net} className="font-semibold" />
                      </Td>
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
