import { FileText } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { MoneyCell } from '../../components/shared/MoneyCell'
import { PageHeader } from '../../components/shared/PageHeader'
import { Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { useAuthed } from '../../mock/session'
import { monthLabel, usePayroll } from '../../mock/stores/payroll'

export function MyPayslipsPage() {
  const { employee } = useAuthed()
  const runs = usePayroll((s) => s.runs)
  const items = usePayroll((s) => s.items)
  const navigate = useNavigate()
  const slips = useMemo(
    () =>
      items
        .filter((i) => i.employee_id === employee.id)
        .flatMap((item) => {
          const run = runs.find((r) => r.id === item.run_id)
          return run && run.status === 'paid' ? [{ run, item }] : []
        })
        .sort((a, b) => b.run.year * 100 + b.run.month - (a.run.year * 100 + a.run.month)),
    [items, runs, employee.id],
  )
  const open = (runId: string, itemId: string) => navigate(`/payroll/${runId}/payslip/${itemId}`)

  return (
    <div className="mx-auto max-w-content">
      <PageHeader title="My payslips" description="Payslips appear here once the month's payroll is paid." />
      {slips.length === 0 ? (
        <EmptyTable icon={FileText} title="No payslips yet" description="Your first payslip will show up after payroll is paid." />
      ) : (
        <Table>
          <Thead>
            <Tr className="hover:bg-transparent">
              <Th>Month</Th>
              <Th>Paid on</Th>
              <Th numeric>Gross</Th>
              <Th numeric>Net pay</Th>
            </Tr>
          </Thead>
          <Tbody>
            {slips.map(({ run, item }) => (
              <Tr
                key={item.id}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => open(run.id, item.id)}
                onKeyDown={(e) => e.key === 'Enter' && open(run.id, item.id)}
              >
                <Td className="font-medium">{monthLabel(run.year, run.month)}</Td>
                <Td className="text-fg-muted">{run.paid_at ? formatDate(run.paid_at) : '-'}</Td>
                <Td>
                  <MoneyCell amount={item.gross} />
                </Td>
                <Td>
                  <MoneyCell amount={item.net} className="font-semibold" />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
