import { Plus, Wallet } from 'lucide-react'
import { router } from '@inertiajs/react'
import { useMemo } from 'react'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { MoneyCell } from '../../components/shared/MoneyCell'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Bars } from '../../components/charts/Bars'
import { Button, Card, CardBody, CardHeader, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { useShared } from '../../inertia/props'
import { formatDate, formatMoney } from '../../lib/format'
import type { PayrollRun } from '../../types'
import { payrollSeries } from './charts'
import { act, monthLabel, type PersonRef, type RunTotals } from './helpers'

export default function RunsPage() {
  const { runs, people } = useShared<{ runs: (PayrollRun & { totals: RunTotals })[]; people: PersonRef[] }>()
  const series = useMemo(() => payrollSeries(runs, 12), [runs])
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name

  const sorted = useMemo(() => [...runs].sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month)), [runs])
  const next = useMemo(() => {
    const last = sorted[0]
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
          <Button variant="primary" icon={<Plus size={16} />} onClick={start}>
            Start payroll for {monthLabel(next.year, next.month)}
          </Button>
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
                  <Td className="font-medium">{monthLabel(r.year, r.month)}</Td>
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
                  <Td className="text-fg-muted">{r.approved_by ? (nameOf(r.approved_by) ?? '-') : '-'}</Td>
                  <Td className="text-fg-muted">{r.paid_at ? formatDate(r.paid_at) : '-'}</Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
