import { Download, FileText } from 'lucide-react'
import { router } from '@inertiajs/react'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { MoneyCell } from '../../components/shared/MoneyCell'
import { PageHeader } from '../../components/shared/PageHeader'
import { buttonVariants, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { useShared } from '../../inertia/props'
import type { PayrollItem, PayrollRun } from '../../types'
import { monthLabel } from './helpers'

export default function MyPayslipsPage() {
  const { slips } = useShared<{ slips: { run: PayrollRun; item: PayrollItem }[] }>()
  const open = (itemId: string) => router.get(route('payroll.payslip', itemId))

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
              <Th>
                <span className="sr-only">PDF</span>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {slips.map(({ run, item }) => (
              <Tr
                key={item.id}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => open(item.id)}
                onKeyDown={(e) => e.key === 'Enter' && open(item.id)}
              >
                <Td className="font-medium">{monthLabel(run.year, run.month)}</Td>
                <Td className="text-fg-muted">{run.paid_at ? formatDate(run.paid_at) : '-'}</Td>
                <Td>
                  <MoneyCell amount={item.gross} />
                </Td>
                <Td>
                  <MoneyCell amount={item.net} className="font-semibold" />
                </Td>
                <Td onClick={(e) => e.stopPropagation()}>
                  <a href={route('payroll.payslip.pdf', item.id)} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    <Download size={14} aria-hidden /> PDF
                  </a>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
