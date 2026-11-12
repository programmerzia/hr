import { ChevronDown, Plus, Wallet } from 'lucide-react'
import { router, useForm } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { MoneyCell } from '../../components/shared/MoneyCell'
import { PageHeader } from '../../components/shared/PageHeader'
import { Badge } from '../../components/ui'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Bars } from '../../components/charts/Bars'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  Input,
  NativeSelect,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui'
import { useShared } from '../../inertia/props'
import { formatDate, formatMoney } from '../../lib/format'
import type { PayrollRun } from '../../types'
import { payrollSeries } from './charts'
import { act, monthLabel, runTitle, type PersonRef, type RunTotals } from './helpers'

interface ExitedPerson {
  id: string
  name: string
  code: string
  exited_on: string
}

function FestivalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const now = new Date()
  const form = useForm({ kind: 'festival', month_input: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, bonus_percent_of_basic: '100', label: '' })
  const errors = form.errors as Record<string, string>
  const submit = () => {
    const [year, month] = form.data.month_input.split('-').map(Number)
    form.transform(({ month_input: _m, ...d }) => ({ ...d, year, month }))
    form.post(route('payroll.runs.store'), { preserveScroll: true, onSuccess: () => onOpenChange(false) })
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New festival bonus run"
      description="One item per full-time employee: basic salary times the percentage. No deductions apply."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!form.data.label.trim() || !(Number(form.data.bonus_percent_of_basic) > 0) || form.processing}>
            Create run
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Name" required error={errors.label ?? errors.payroll}>
          <Input value={form.data.label} onChange={(e) => form.setData('label', e.target.value)} placeholder="Eid-ul-Fitr bonus" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bonus (% of basic)" required error={errors.bonus_percent_of_basic}>
            <Input type="number" min={1} max={200} value={form.data.bonus_percent_of_basic} onChange={(e) => form.setData('bonus_percent_of_basic', e.target.value)} />
          </Field>
          <Field label="Month" required>
            <Input type="month" value={form.data.month_input} onChange={(e) => form.setData('month_input', e.target.value)} />
          </Field>
        </div>
      </div>
    </Dialog>
  )
}

function SettlementDialog({ open, onOpenChange, exited }: { open: boolean; onOpenChange: (o: boolean) => void; exited: ExitedPerson[] }) {
  const form = useForm({ kind: 'settlement', employee_id: exited[0]?.id ?? '' })
  const errors = form.errors as Record<string, string>
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New final settlement"
      description="Prorated salary up to the exit date plus unused leave. Add asset deductions as adjustments."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!form.data.employee_id || form.processing}
            onClick={() => form.post(route('payroll.runs.store'), { preserveScroll: true, onSuccess: () => onOpenChange(false) })}
          >
            Create settlement
          </Button>
        </>
      }
    >
      {exited.length === 0 ? (
        <p className="text-sm text-fg-muted">Nobody is waiting for a settlement. Set an employee to resigned or terminated with an exit date first.</p>
      ) : (
        <Field label="Employee" required error={errors.employee_id ?? errors.payroll}>
          <NativeSelect value={form.data.employee_id} onChange={(e) => form.setData('employee_id', e.target.value)}>
            {exited.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code}), left {formatDate(p.exited_on)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
    </Dialog>
  )
}

export default function RunsPage() {
  const { runs, people, exited } = useShared<{ runs: (PayrollRun & { totals: RunTotals })[]; people: PersonRef[]; exited: ExitedPerson[] }>()
  const [dialog, setDialog] = useState<'festival' | 'settlement' | null>(null)
  const series = useMemo(() => payrollSeries(runs, 12), [runs])
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name

  const sorted = useMemo(() => [...runs].sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month)), [runs])
  const next = useMemo(() => {
    const last = sorted.find((r) => (r.kind ?? 'regular') === 'regular')
    if (!last) {
      const d = new Date()
      return { year: d.getFullYear(), month: d.getMonth() + 1 }
    }
    return last.month === 12 ? { year: last.year + 1, month: 1 } : { year: last.year, month: last.month + 1 }
  }, [sorted])

  const open = (id: string) => router.get(route('payroll.runs.show', id))
  const start = () => act(route('payroll.runs.store'), next)

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="Payroll"
        description="One run per month. HR drafts, management approves, HR marks paid."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="primary" icon={<Plus size={16} />}>
                New run <ChevronDown size={14} aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={start}>Regular, {monthLabel(next.year, next.month)}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog('festival')}>Festival bonus</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog('settlement')}>Final settlement</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      {series.data.length > 1 && (
        <Card className="mb-4">
          <CardHeader
            title="Gross by month"
            actions={<span className="font-mono text-sm tabular-nums text-fg-muted">{formatMoney(series.latestGross)} latest</span>}
          />
          <CardBody>
            <Bars
              data={series.data}
              series={[{ name: 'Gross' }]}
              height={112}
              format={(v) => formatMoney(v)}
              aria-label={`Gross payroll for the last ${series.data.length} runs`}
            />
          </CardBody>
        </Card>
      )}
      {sorted.length === 0 ? (
        <EmptyTable icon={Wallet} title="No payroll runs yet" description="Start the first run to calculate salaries for full-time staff." />
      ) : (
        <Table>
          <Thead>
            <Tr className="hover:bg-transparent">
              <Th>Month</Th>
              <Th numeric>Employees</Th>
              <Th numeric>Gross</Th>
              <Th numeric>Net</Th>
              <Th>Status</Th>
              <Th numeric>On hold</Th>
              <Th>Approved by</Th>
              <Th>Paid on</Th>
            </Tr>
          </Thead>
          <Tbody>
            {sorted.map((r) => {
              return (
                <Tr
                  key={r.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  onClick={() => open(r.id)}
                  onKeyDown={(e) => e.key === 'Enter' && open(r.id)}
                >
                  <Td className="font-medium">
                    {r.kind === 'settlement' ? runTitle(r, nameOf(r.employee_id ?? '')) : runTitle(r)}
                    {r.kind && r.kind !== 'regular' && (
                      <Badge variant="info" className="ml-2">
                        {r.kind === 'festival' ? 'Festival bonus' : 'Final settlement'}
                      </Badge>
                    )}
                  </Td>
                  <Td numeric>{r.totals.employees}</Td>
                  <Td>
                    <MoneyCell amount={r.totals.gross} />
                  </Td>
                  <Td>
                    <MoneyCell amount={r.totals.net} />
                  </Td>
                  <Td>
                    <StatusBadge status={r.status} />
                  </Td>
                  <Td numeric>{r.totals.held ? <span className="text-warning">{r.totals.held}</span> : <span className="text-fg-muted">0</span>}</Td>
                  <Td className="text-fg-muted">{r.approved_by ? (nameOf(r.approved_by) ?? '-') : '-'}</Td>
                  <Td className="text-fg-muted">{r.paid_at ? formatDate(r.paid_at) : '-'}</Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      )}
      {dialog === 'festival' && <FestivalDialog open onOpenChange={(o) => !o && setDialog(null)} />}
      {dialog === 'settlement' && <SettlementDialog open onOpenChange={(o) => !o && setDialog(null)} exited={exited} />}
    </div>
  )
}
