import { CalendarDays, FileText } from 'lucide-react'
import { Bars } from '../../components/charts/Bars'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { MoneyCell } from '../../components/shared/MoneyCell'
import { Card, CardBody, CardHeader, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { cn } from '../../lib/cn'
import { formatMoney } from '../../lib/format'
import type { DepartmentReport, Money, Sheet, Statement, SummaryMonth } from './types'

const money = (v: number) => (v === 0 ? <span className="block text-right text-fg-subtle">-</span> : <MoneyCell amount={v} />)

export function SummaryView({ months }: { months: SummaryMonth[] }) {
  const data = months.map((m, i) => ({
    label: m.label.slice(0, 3),
    values: [m.gross, m.net, m.employer_cost],
    active: i === months.length - 1 ? true : undefined,
  }))
  const any = months.some((m) => m.headcount > 0)
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Gross, net and employer cost, last 12 months" />
        <CardBody>
          <Bars
            data={data}
            series={[{ name: 'Gross' }, { name: 'Net' }, { name: 'Employer cost' }]}
            height={160}
            format={(v) => formatMoney(v)}
            aria-label="Gross, net and employer cost for the last 12 months"
          />
        </CardBody>
      </Card>
      {!any ? (
        <EmptyTable icon={FileText} title="No approved payroll yet" description="Approved and paid regular runs appear here." />
      ) : (
        <Table>
          <Thead>
            <Tr className="hover:bg-transparent">
              <Th>Month</Th>
              <Th numeric>Staff</Th>
              <Th numeric>Gross</Th>
              <Th numeric>Overtime</Th>
              <Th numeric>Bonus</Th>
              <Th numeric>LOP</Th>
              <Th numeric>Late</Th>
              <Th numeric>Tax</Th>
              <Th numeric>PF (emp)</Th>
              <Th numeric>PF (er)</Th>
              <Th numeric>Other ded.</Th>
              <Th numeric>Net</Th>
              <Th numeric>Employer cost</Th>
            </Tr>
          </Thead>
          <Tbody>
            {months.map((m) => (
              <Tr key={`${m.year}-${m.month}`} className={cn(m.headcount === 0 && 'text-fg-subtle')}>
                <Td className="font-medium">{m.label}</Td>
                <Td numeric>{m.headcount || '-'}</Td>
                <Td>{money(m.gross)}</Td>
                <Td>{money(m.overtime)}</Td>
                <Td>{money(m.bonus)}</Td>
                <Td>{money(m.lop)}</Td>
                <Td>{money(m.late)}</Td>
                <Td>{money(m.tax)}</Td>
                <Td>{money(m.pf_employee)}</Td>
                <Td>{money(m.pf_employer)}</Td>
                <Td>{money(m.other_deductions)}</Td>
                <Td>{money(m.net)}</Td>
                <Td>{money(m.employer_cost)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}

export function DepartmentView({ report }: { report: DepartmentReport }) {
  if (report.rows.length === 0) {
    return <EmptyTable icon={FileText} title="No approved payroll for this month" description="Pick another month, or approve the run first." />
  }
  return (
    <Table>
      <Thead>
        <Tr className="hover:bg-transparent">
          <Th>Department</Th>
          <Th numeric>Staff</Th>
          <Th numeric>Gross</Th>
          <Th numeric>Employer cost</Th>
          <Th numeric>Net</Th>
        </Tr>
      </Thead>
      <Tbody>
        {report.rows.map((r) => (
          <Tr key={r.department_id ?? 'none'}>
            <Td className="font-medium">{r.department}</Td>
            <Td numeric>{r.headcount}</Td>
            <Td>{money(r.gross)}</Td>
            <Td>{money(r.employer_cost)}</Td>
            <Td>{money(r.net)}</Td>
          </Tr>
        ))}
        <Tr className="font-medium hover:bg-transparent">
          <Td>Total</Td>
          <Td numeric>{report.total.headcount}</Td>
          <Td>{money(report.total.gross)}</Td>
          <Td>{money(report.total.employer_cost)}</Td>
          <Td>{money(report.total.net)}</Td>
        </Tr>
      </Tbody>
    </Table>
  )
}

const stmtCols: { key: keyof Money; label: string }[] = [
  { key: 'gross', label: 'Gross' },
  { key: 'overtime', label: 'Overtime' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'lop', label: 'LOP' },
  { key: 'late', label: 'Late' },
  { key: 'tax', label: 'Tax' },
  { key: 'pf_employee', label: 'PF (emp)' },
  { key: 'pf_employer', label: 'PF (er)' },
  { key: 'net', label: 'Net' },
]

export function StatementView({ statement }: { statement: Statement }) {
  const { employee, months, totals, pf_balance: pf } = statement
  return (
    <div className="space-y-3">
      <div className="hidden print:block">
        <h2 className="text-lg font-semibold">Year-to-date statement, tax year {statement.label}</h2>
        <p className="text-sm">
          {employee.name} ({employee.code})
        </p>
      </div>
      <Table>
        <Thead>
          <Tr className="hover:bg-transparent">
            <Th>Month</Th>
            {stmtCols.map((c) => (
              <Th key={c.key} numeric>
                {c.label}
              </Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {months.map((m) => (
            <Tr key={`${m.year}-${m.month}`} className={cn(!m.paid && 'text-fg-subtle')}>
              <Td className="font-medium">{m.label}</Td>
              {stmtCols.map((c) => (
                <Td key={c.key}>{money(m[c.key])}</Td>
              ))}
            </Tr>
          ))}
          <Tr className="font-medium hover:bg-transparent">
            <Td>Total</Td>
            {stmtCols.map((c) => (
              <Td key={c.key}>{money(totals[c.key])}</Td>
            ))}
          </Tr>
        </Tbody>
      </Table>
      {pf && (
        <p className="text-sm text-fg-muted">
          Provident fund balance to date: employee <span className="font-mono tabular-nums">{formatMoney(pf.employee)}</span>, employer{' '}
          <span className="font-mono tabular-nums">{formatMoney(pf.employer)}</span>.
        </p>
      )}
    </div>
  )
}

const cellStyle: Record<string, string> = {
  P: 'text-success',
  '½': 'text-warning font-medium',
  A: 'bg-danger/10 text-danger font-semibold',
  L: 'text-info',
  U: 'text-warning',
  H: 'text-fg-subtle',
  W: 'text-fg-subtle',
  '-': 'text-fg-subtle',
}

export function SheetView({ sheet }: { sheet: Sheet }) {
  if (sheet.rows.length === 0) {
    return <EmptyTable icon={CalendarDays} title="No people in this view" description="Nobody matches the filters for this month." />
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-fg-muted">
        P present, ½ half day, A absent (unapproved), L paid leave, U unpaid leave, H holiday, W weekend, - not closed yet.
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-xs" data-testid="attendance-sheet">
          <thead className="bg-surface-2">
            <tr>
              <th className="sticky left-0 z-10 min-w-40 bg-surface-2 px-2 py-1 text-left font-medium">Person</th>
              {sheet.days.map((d) => (
                <th key={d.date} className={cn('w-6 min-w-6 px-0.5 py-1 text-center font-normal', d.type !== 'work' && 'text-fg-subtle')}>
                  <div>{d.day}</div>
                  <div className="text-[10px] text-fg-subtle">{d.dow.slice(0, 1)}</div>
                </th>
              ))}
              {['P', '½', 'A', 'L', 'Late'].map((h) => (
                <th key={h} className="px-1.5 py-1 text-right font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((r) => (
              <tr key={r.employee.id} className="border-t border-border">
                <td className="sticky left-0 z-10 truncate bg-surface px-2 py-1 text-sm">{r.employee.name}</td>
                {r.cells.map((c, i) => (
                  <td key={i} className={cn('px-0.5 py-1 text-center font-mono', sheet.days[i].type !== 'work' && 'bg-surface-2/60', cellStyle[c])}>
                    {c}
                  </td>
                ))}
                <td className="px-1.5 text-right font-mono tabular-nums">{r.totals.present}</td>
                <td className="px-1.5 text-right font-mono tabular-nums">{r.totals.half}</td>
                <td className="px-1.5 text-right font-mono tabular-nums">{r.totals.absent}</td>
                <td className="px-1.5 text-right font-mono tabular-nums">{r.totals.leave}</td>
                <td className="px-1.5 text-right font-mono tabular-nums">{r.totals.late}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
