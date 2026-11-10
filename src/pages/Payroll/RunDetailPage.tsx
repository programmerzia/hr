import { Check, FileText, RefreshCw, Send, Trash2, Users, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
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
  Dialog,
  EmptyState,
  Field,
  Input,
  NativeSelect,
  Sheet,
  Stat,
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
import { useAuthed } from '../../mock/session'
import { monthLabel, netAdjustment, usePayroll } from '../../mock/stores/payroll'
import { todayIso, usePeopleStore } from '../../mock/stores/people'
import type { PayrollAdjustmentKind } from '../../types'

const hours = (minutes: number) => formatDuration(minutes * 60)

function MarkPaidDialog({ open, onOpenChange, runId, label }: { open: boolean; onOpenChange: (o: boolean) => void; runId: string; label: string }) {
  const { employee } = useAuthed()
  const markPaid = usePayroll((s) => s.markPaid)
  const [paidOn, setPaidOn] = useState(todayIso())
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    const res = markPaid(runId, paidOn, reference, employee.id)
    if (res.ok) onOpenChange(false)
    else setError(res.error)
  }

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
          <Button variant="primary" onClick={submit} disabled={!paidOn}>
            Mark as paid
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Disbursement date" required>
          <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </Field>
        <Field label="Bank reference" required error={error || undefined} hint="Batch or transfer reference from the bank.">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="BEFTN-202611-001" />
        </Field>
      </div>
    </Dialog>
  )
}

function ItemSheet({ itemId, onClose }: { itemId: string | null; onClose: () => void }) {
  const { employee } = useAuthed()
  const item = usePayroll((s) => s.items.find((i) => i.id === itemId))
  const run = usePayroll((s) => s.runs.find((r) => r.id === item?.run_id))
  const allAdjustments = usePayroll((s) => s.adjustments)
  const addAdjustment = usePayroll((s) => s.addAdjustment)
  const removeAdjustment = usePayroll((s) => s.removeAdjustment)
  const emp = usePeopleStore((s) => (item ? s.employeeById(item.employee_id) : undefined))
  const [kind, setKind] = useState<PayrollAdjustmentKind>('bonus')
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const adjustments = allAdjustments.filter((a) => a.item_id === itemId)
  const locked = !run || (run.status !== 'draft' && run.status !== 'review')

  const add = () => {
    if (!item) return
    const res = addAdjustment(item.id, kind, label, Number(amount), note, employee.id)
    if (res.ok) {
      setLabel('')
      setAmount('')
      setNote('')
      setError('')
    } else setError(res.error)
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
      open={Boolean(itemId && item && run)}
      onOpenChange={(o) => !o && onClose()}
      title={emp?.name ?? 'Payroll item'}
      description={run ? `${monthLabel(run.year, run.month)} breakdown` : undefined}
      footer={
        item && run ? (
          <Link to={`/payroll/${run.id}/payslip/${item.id}`} className={buttonVariants({ variant: 'secondary' })}>
            <FileText size={16} aria-hidden /> View payslip
          </Link>
        ) : undefined
      }
    >
      {item && run && (
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
                          onClick={() => {
                            const res = removeAdjustment(a.id, employee.id)
                            if (!res.ok) toast.error(res.error)
                          }}
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
                    <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as PayrollAdjustmentKind)}>
                      <option value="bonus">Bonus</option>
                      <option value="deduction">Deduction</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Amount (BDT)">
                    <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </Field>
                </div>
                <Field label="Label">
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Project delivery bonus" />
                </Field>
                <Field label="Note" error={error || undefined}>
                  <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
                <div className="flex justify-end">
                  <Button variant="primary" onClick={add} disabled={!label.trim() || !(Number(amount) > 0)}>
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

export function RunDetailPage() {
  const { runId = '' } = useParams()
  const { employee, role } = useAuthed()
  const run = usePayroll((s) => s.runs.find((r) => r.id === runId))
  const allItems = usePayroll((s) => s.items)
  const adjustments = usePayroll((s) => s.adjustments)
  const events = usePayroll((s) => s.events)
  const recompute = usePayroll((s) => s.recompute)
  const submitForReview = usePayroll((s) => s.submitForReview)
  const approveRun = usePayroll((s) => s.approveRun)
  const totalsFor = usePayroll((s) => s.totalsFor)
  const people = usePeopleStore()

  const [selected, setSelected] = useState<string | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)

  const items = useMemo(
    () =>
      allItems
        .filter((i) => i.run_id === runId)
        .sort((a, b) => (people.employeeById(a.employee_id)?.name ?? '').localeCompare(people.employeeById(b.employee_id)?.name ?? '')),
    [allItems, runId, people],
  )
  const history = useMemo(
    () =>
      events
        .filter((e) => e.run_id === runId)
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((e) => ({ at: e.at, actor: people.employeeById(e.actor_id)?.name ?? 'Someone', text: e.text })),
    [events, runId, people],
  )

  if (!run) {
    return (
      <EmptyState
        icon={Wallet}
        title="Payroll run not found"
        description="It may have been removed, or the link is wrong."
        action={
          <Link to="/payroll" className={buttonVariants({ variant: 'secondary' })}>
            Back to payroll
          </Link>
        }
      />
    )
  }

  const label = monthLabel(run.year, run.month)
  const totals = totalsFor(run.id)
  const open = run.status === 'draft' || run.status === 'review'
  const act = (res: { ok: boolean } & { error?: string }) => {
    if (!res.ok && res.error) toast.error(res.error)
  }

  const actions = (
    <>
      {open && (
        <Button
          icon={<RefreshCw size={16} />}
          onClick={() => {
            const res = recompute(run.id, employee.id)
            if (res.ok) toast.success('Recomputed from attendance and leave')
            else act(res)
          }}
        >
          Recompute
        </Button>
      )}
      {run.status === 'draft' && (
        <Button variant="primary" icon={<Send size={16} />} onClick={() => act(submitForReview(run.id, employee.id))}>
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

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Employees" value={totals.employees} />
        <Stat label="Gross" value={formatMoney(totals.gross)} />
        <Stat label="Deductions" value={formatMoney(totals.deductions)} />
        <Stat label="Net payable" value={formatMoney(totals.net)} />
      </div>

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
                  const emp = people.employeeById(i.employee_id)
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

      <ItemSheet itemId={selected} onClose={() => setSelected(null)} />
      <MarkPaidDialog key={String(payOpen)} open={payOpen} onOpenChange={setPayOpen} runId={run.id} label={label} />
      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title={`Approve ${label}`}
        description={`Approving locks the run. ${totals.employees} employees, net payable ${formatMoney(totals.net)}.`}
        confirmLabel="Approve and lock"
        onConfirm={() => {
          const res = approveRun(run.id, employee.id)
          setApproveOpen(false)
          act(res)
        }}
      />
    </div>
  )
}
