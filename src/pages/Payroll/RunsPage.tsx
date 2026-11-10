import { Plus, Wallet } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { MoneyCell } from '../../components/shared/MoneyCell'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Bars } from '../../components/charts/Bars'
import { Button, Card, CardBody, CardHeader, Table, Tbody, Td, Th, Thead, Tr, toast } from '../../components/ui'
import { formatDate, formatMoney } from '../../lib/format'
import { useAuthed } from '../../mock/session'
import { monthLabel, usePayroll } from '../../mock/stores/payroll'
import { usePeopleStore } from '../../mock/stores/people'
import { usePayrollSeries } from './usePayrollSeries'

export function RunsPage() {
  const { employee } = useAuthed()
  const navigate = useNavigate()
  const runs = usePayroll((s) => s.runs)
  const items = usePayroll((s) => s.items)
  const series = usePayrollSeries(12)
  const draftRun = usePayroll((s) => s.draftRun)
  const employeeById = usePeopleStore((s) => s.employeeById)

  const sorted = useMemo(() => [...runs].sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month)), [runs])
  const next = useMemo(() => {
    const last = sorted[0]
    if (!last) {
      const d = new Date()
      return { year: d.getFullYear(), month: d.getMonth() + 1 }
    }
    return last.month === 12 ? { year: last.year + 1, month: 1 } : { year: last.year, month: last.month + 1 }
  }, [sorted])

  const start = () => {
    const res = draftRun(next.year, next.month, employee.id)
    if (res.ok) navigate(`/payroll/${res.value.id}`)
    else toast.error(res.error)
  }

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
              const rows = items.filter((i) => i.run_id === r.id)
              return (
                <Tr
                  key={r.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  onClick={() => navigate(`/payroll/${r.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/payroll/${r.id}`)}
                >
                  <Td className="font-medium">{monthLabel(r.year, r.month)}</Td>
                  <Td numeric>{rows.length}</Td>
                  <Td>
                    <MoneyCell amount={rows.reduce((t, i) => t + i.gross, 0)} />
                  </Td>
                  <Td>
                    <MoneyCell amount={rows.reduce((t, i) => t + i.net, 0)} />
                  </Td>
                  <Td>
                    <StatusBadge status={r.status} />
                  </Td>
                  <Td className="text-fg-muted">{r.approved_by ? (employeeById(r.approved_by)?.name ?? '-') : '-'}</Td>
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
