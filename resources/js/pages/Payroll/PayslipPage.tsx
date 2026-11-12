import { Download, Printer } from 'lucide-react'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button, buttonVariants } from '../../components/ui'
import { useShared } from '../../inertia/props'
import { formatDate, formatDuration, formatMoney } from '../../lib/format'
import type { BankAccount, PayrollAdjustment, PayrollItem, PayrollPolicySwitches, PayrollRun } from '../../types'
import { monthEnd, monthLabel, monthStart, type PersonRef } from './helpers'
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

interface PayslipProps {
  run: PayrollRun
  item: PayrollItem
  adjustments: PayrollAdjustment[]
  employee: PersonRef
  department: string | null
  bank: BankAccount | null
  staff: boolean
  policy: PayrollPolicySwitches
}

const days = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export default function PayslipPage() {
  const { run, item, adjustments, employee: emp, department, bank, staff, policy } = useShared<PayslipProps>()
  const c = item.components
  const bonuses = adjustments.filter((a) => a.kind === 'bonus')
  const deductionAdj = adjustments.filter((a) => a.kind === 'deduction')
  const totalEarnings = item.gross + item.overtime_pay + bonuses.reduce((t, a) => t + a.amount, 0)
  const totalDeductions = totalEarnings - item.net
  const showTax = policy.tax_enabled || item.tax > 0
  const showPf = policy.pf_enabled || item.pf > 0
  const showLop = policy.lop_enabled || item.unpaid_deduction > 0
  const showLate = policy.late_penalty_enabled || item.late_deduction > 0
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
            <>
              <a href={route('payroll.payslip.pdf', item.id)} className={buttonVariants({ variant: 'primary' })}>
                <Download size={16} aria-hidden /> Download PDF
              </a>
              <Button icon={<Printer size={16} />} onClick={() => window.print()}>
                Print
              </Button>
            </>
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
          <p><span className="text-fg-muted">Employee </span><span className="font-medium">{emp.name}</span></p>
          <p><span className="text-fg-muted">Employee ID </span><span className="font-mono">{emp.code}</span></p>
          <p><span className="text-fg-muted">Designation </span>{emp.designation}</p>
          <p><span className="text-fg-muted">Department </span>{department ?? '-'}</p>
          <p><span className="text-fg-muted">Joined </span>{emp.joined_on ? formatDate(emp.joined_on) : '-'}</p>
          <p>
            <span className="text-fg-muted">Attendance </span>
            {formatDuration(item.worked_minutes * 60)} of {formatDuration(item.standard_minutes * 60)}
          </p>
          <p><span className="text-fg-muted">Payable days </span>{days(item.eligible_days)}</p>
          {item.paid_leave_days > 0 && <p><span className="text-fg-muted">Paid leave </span>{days(item.paid_leave_days)} days</p>}
          {(item.lop_days > 0 || item.absent_days + item.half_days + item.unpaid_leave_days > 0) && (
            <p className="col-span-2">
              <span className="text-fg-muted">Loss of pay </span>
              {days(item.lop_days)} days
              <span className="text-fg-muted">
                {' '}
                (absent {days(item.absent_days)}, half days {days(item.half_days)}, unpaid leave {days(item.unpaid_leave_days)})
              </span>
            </p>
          )}
          {item.late_count > 0 && <p><span className="text-fg-muted">Late arrivals </span>{item.late_count}</p>}
        </section>

        <section className="grid grid-cols-1 gap-6 py-4 sm:grid-cols-2">
          <div>
            <h2 className="mb-1 text-sm font-semibold">Earnings</h2>
            <table className="w-full text-sm">
              <tbody>
                {c ? (
                  <>
                    <Row label="Basic" value={formatMoney(c.basic)} />
                    <Row label="House rent" value={formatMoney(c.house_rent)} />
                    <Row label="Medical" value={formatMoney(c.medical)} />
                    <Row label="Conveyance" value={formatMoney(c.conveyance)} />
                    {c.other_allowances.map((o) => (
                      <Row key={o.label} label={o.label} value={formatMoney(o.amount)} />
                    ))}
                  </>
                ) : (
                  <Row label="Gross salary" value={formatMoney(item.gross)} />
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
                {showTax && <Row label="Income tax" value={formatMoney(item.tax)} />}
                {showPf && <Row label="Provident fund" value={formatMoney(item.pf)} />}
                {showLop && <Row label={`Loss of pay (${days(item.lop_days)} days)`} value={formatMoney(item.unpaid_deduction)} />}
                {showLate && <Row label={`Late penalty (${days(item.late_penalty_days)} days)`} value={formatMoney(item.late_deduction)} />}
                {deductionAdj.map((a) => (
                  <Row key={a.id} label={a.label} value={formatMoney(a.amount)} />
                ))}
                <Row label="Total deductions" value={formatMoney(totalDeductions)} strong />
              </tbody>
            </table>
          </div>
        </section>

        {item.slices.length > 1 && (
          <section className="border-t border-border py-3 text-sm">
            <h2 className="mb-1 font-semibold">Salary changes this month</h2>
            {item.slices.map((sl) => (
              <p key={sl.effective_from} className="flex justify-between">
                <span className="text-fg-muted">
                  From {formatDate(sl.effective_from)}, {days(sl.days)} days of {formatMoney(sl.gross)}
                </span>
                <span className="font-mono tabular-nums">{formatMoney(sl.gross_share)}</span>
              </p>
            ))}
          </section>
        )}
        {item.pf_employer > 0 && <p className="pb-3 text-sm text-fg-muted">Employer provident fund contribution {formatMoney(item.pf_employer)}</p>}

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

// The route is bare (no app shell): the sheet prints on its own.
PayslipPage.layout = null
