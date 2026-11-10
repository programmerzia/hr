import { Printer, ShieldOff } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button, buttonVariants, EmptyState } from '../../components/ui'
import { formatDate, formatDuration, formatMoney } from '../../lib/format'
import { useAuthed } from '../../mock/session'
import { monthEnd, monthLabel, monthStart } from '../../mock/db/payroll'
import { usePayroll } from '../../mock/stores/payroll'
import { usePeopleStore } from '../../mock/stores/people'
import { cn } from '../../lib/cn'

/** The route is bare (no app shell), so printing only needs an A4 page. */
const printCss = `
@page { size: A4; margin: 12mm; }
@media print { .payslip-sheet { border: 0 !important; box-shadow: none !important; } }
`

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className={cn('py-1.5 pr-3', muted && 'text-fg-muted', strong && 'font-semibold')}>{label}</td>
      <td className={cn('py-1.5 text-right font-mono tabular-nums', strong && 'font-semibold')}>{value}</td>
    </tr>
  )
}

export function PayslipPage() {
  const { runId = '', itemId = '' } = useParams()
  const { employee: viewer, role } = useAuthed()
  const run = usePayroll((s) => s.runs.find((r) => r.id === runId))
  const item = usePayroll((s) => s.items.find((i) => i.id === itemId && i.run_id === runId))
  const allAdjustments = usePayroll((s) => s.adjustments)
  const adjustments = useMemo(() => allAdjustments.filter((a) => a.item_id === itemId), [allAdjustments, itemId])
  const people = usePeopleStore()

  const staff = role === 'hr' || role === 'management'
  const allowed = item && run && (staff || (item.employee_id === viewer.id && run.status === 'paid'))

  if (!run || !item || !allowed) {
    return (
      <EmptyState
        icon={ShieldOff}
        title={item && run ? "You don't have access to this payslip" : 'Payslip not found'}
        description={item && run ? 'Payslips are visible to their owner, HR and management.' : 'It may have been removed, or the link is wrong.'}
        action={
          <Link to={staff ? '/payroll' : '/payslips'} className={buttonVariants({ variant: 'secondary' })}>
            Back to payslips
          </Link>
        }
      />
    )
  }

  const emp = people.employeeById(item.employee_id)
  const salary = people.salaryStructures.find((s) => s.id === item.salary_structure_id)
  const bank = people.bankAccounts.find((b) => b.id === item.bank_account_id)
  const dept = people.departments.find((d) => d.id === emp?.department_id)
  const bonuses = adjustments.filter((a) => a.kind === 'bonus')
  const deductionAdj = adjustments.filter((a) => a.kind === 'deduction')
  const totalEarnings = item.gross + item.overtime_pay + bonuses.reduce((t, a) => t + a.amount, 0)
  const totalDeductions = totalEarnings - item.net
  const label = monthLabel(run.year, run.month)
  const isDraft = run.status !== 'paid' && run.status !== 'approved'

  return (
    <div className="mx-auto max-w-3xl">
      <style>{printCss}</style>
      <div className="print:hidden">
        <PageHeader
          title={`Payslip, ${label}`}
          breadcrumb={staff ? [{ label: 'Payroll', to: '/payroll' }, { label, to: `/payroll/${run.id}` }, { label: 'Payslip' }] : [{ label: 'My payslips', to: '/payslips' }, { label }]}
          actions={
            <Button icon={<Printer size={16} />} onClick={() => window.print()}>
              Print or save as PDF
            </Button>
          }
        />
        {isDraft && <p className="mb-3 text-sm text-warning">This run is not approved yet. Figures can still change.</p>}
      </div>

      <article className="payslip-sheet rounded-md border border-border bg-surface p-8 text-base">
        <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-xl font-semibold">Vivacom</p>
            <p className="text-sm text-fg-muted">Payslip for {label}</p>
          </div>
          <div className="text-right text-sm text-fg-muted">
            <p>
              Period {formatDate(monthStart(run.year, run.month))} to {formatDate(monthEnd(run.year, run.month))}
            </p>
            {run.paid_at && <p>Paid on {formatDate(run.paid_at)}</p>}
            {run.payment_reference && <p>Reference {run.payment_reference}</p>}
          </div>
        </header>

        <section className="grid grid-cols-2 gap-x-6 gap-y-1 border-b border-border py-4 text-sm">
          <p><span className="text-fg-muted">Employee </span><span className="font-medium">{emp?.name}</span></p>
          <p><span className="text-fg-muted">Employee ID </span><span className="font-mono">{emp?.code}</span></p>
          <p><span className="text-fg-muted">Designation </span>{emp?.designation}</p>
          <p><span className="text-fg-muted">Department </span>{dept?.name ?? '-'}</p>
          <p><span className="text-fg-muted">Joined </span>{emp ? formatDate(emp.joined_on) : '-'}</p>
          <p>
            <span className="text-fg-muted">Attendance </span>
            {formatDuration(item.worked_minutes * 60)} of {formatDuration(item.standard_minutes * 60)}
          </p>
          <p><span className="text-fg-muted">Unpaid leave </span>{item.unpaid_leave_days} days</p>
          <p><span className="text-fg-muted">Late arrivals </span>{item.late_count}</p>
        </section>

        <section className="grid grid-cols-1 gap-6 py-4 sm:grid-cols-2">
          <div>
            <h2 className="mb-1 text-sm font-semibold">Earnings</h2>
            <table className="w-full text-sm">
              <tbody>
                {salary && (
                  <>
                    <Row label="Basic" value={formatMoney(salary.basic)} />
                    <Row label="House rent" value={formatMoney(salary.house_rent)} />
                    <Row label="Medical" value={formatMoney(salary.medical)} />
                    <Row label="Conveyance" value={formatMoney(salary.conveyance)} />
                  </>
                )}
                {item.overtime_pay > 0 && <Row label="Overtime" value={formatMoney(item.overtime_pay)} />}
                {bonuses.map((a) => (
                  <Row key={a.id} label={a.label} value={formatMoney(a.amount)} />
                ))}
                <Row label="Total earnings" value={formatMoney(totalEarnings)} strong />
              </tbody>
            </table>
          </div>
          <div>
            <h2 className="mb-1 text-sm font-semibold">Deductions</h2>
            <table className="w-full text-sm">
              <tbody>
                <Row label="Income tax" value={formatMoney(item.tax)} />
                <Row label={`Provident fund (${salary?.pf_percent ?? 0}% of basic)`} value={formatMoney(item.pf)} />
                {item.unpaid_deduction > 0 && <Row label={`Unpaid leave (${item.unpaid_leave_days} days)`} value={formatMoney(item.unpaid_deduction)} />}
                {item.late_deduction > 0 && <Row label="Late arrival penalty" value={formatMoney(item.late_deduction)} />}
                {deductionAdj.map((a) => (
                  <Row key={a.id} label={a.label} value={formatMoney(a.amount)} />
                ))}
                <Row label="Total deductions" value={formatMoney(totalDeductions)} strong />
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex items-center justify-between rounded border border-border bg-surface-2 px-4 py-3">
          <span className="text-base font-semibold">Net pay</span>
          <span className="font-mono text-xl font-semibold tabular-nums">{formatMoney(item.net)}</span>
        </section>

        <footer className="mt-4 text-sm text-fg-muted">
          {bank ? (
            <p>
              Paid to {bank.account_name}, {bank.bank} ({bank.branch}), account ending {bank.account_no.slice(-4)}.
            </p>
          ) : (
            <p>No bank account on file.</p>
          )}
          <p className="mt-1">This payslip is computer generated and needs no signature.</p>
        </footer>
      </article>
    </div>
  )
}
