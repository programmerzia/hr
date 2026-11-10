import { CheckCheck, ChevronRight, Users } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Bars } from '../../components/charts/Bars'
import { StackedBar } from '../../components/charts/StackedBar'
import { PersonCell } from '../../components/shared/PersonCell'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Badge, Card, CardBody, CardHeader, EmptyState, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { formatDuration, formatMoney, formatTime } from '../../lib/format'
import { presenceTone } from '../../lib/status'
import { useInboxItems } from '../../mock/stores/inbox'
import { useBilling } from '../../mock/stores/billing'
import { usePayroll } from '../../mock/stores/payroll'
import { computeTotals, scopeEmployees, todayKey, useAttendance } from '../../mock/stores/attendance'
import { usePeopleStore } from '../../mock/stores/people'
import { useInvoiceAging } from '../Billing/useInvoiceAging'
import { usePayrollSeries } from '../Payroll/usePayrollSeries'
import type { Role } from '../../types'
import { useHiresSeries, usePresenceScope, usePresenceSegments } from './useHomeData'

const ROWS = 8
const order = ['working', 'on_break', 'ended', 'not_started', 'on_leave', 'absent']

function ViewAll({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-sm text-accent hover:underline">
      {children}
    </Link>
  )
}

/** One wide presence card: a composition bar plus a few inline facts. Replaces the row of stat boxes. */
export function OverviewCard({ employeeId, role }: { employeeId: string; role: Role }) {
  const { people, title } = usePresenceScope(employeeId, role)
  const ids = useMemo(() => people.map((p) => p.id), [people])
  const { segments, total } = usePresenceSegments(ids)
  const allPeople = usePeopleStore((s) => s.employees)
  const facts = useMemo(() => {
    if (role !== 'hr' && role !== 'management') return []
    const current = allPeople.filter((p) => p.exited_on === null)
    const month = todayKey().slice(0, 7)
    return [
      { label: 'Headcount', value: current.length, warn: false },
      { label: 'On probation', value: current.filter((p) => p.status === 'probation').length, warn: false },
      { label: 'Joining this month', value: allPeople.filter((p) => p.joined_on.startsWith(month)).length, warn: false },
    ].filter((f) => f.value > 0)
  }, [allPeople, role])

  return (
    <Card>
      <CardHeader
        title="Overview"
        actions={
          <span className="text-sm text-fg-muted">
            {title} · {total} {total === 1 ? 'person' : 'people'}
          </span>
        }
      />
      <CardBody className="space-y-5">
        <StackedBar
          data-testid="presence-bar"
          height={12}
          segments={segments}
          aria-label={`Presence: ${segments.filter((s) => s.value > 0).map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ')}`}
        />
        {facts.length > 0 && (
          <dl className="flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-4">
            {facts.map((f) => (
              <div key={f.label} className="flex items-baseline gap-2">
                <dd className="stat-value font-mono text-xl font-medium tabular-nums">{f.value}</dd>
                <dt className="text-sm text-fg-muted">{f.label}</dt>
              </div>
            ))}
          </dl>
        )}
      </CardBody>
    </Card>
  )
}

export function TeamNowCard({ employeeId, role }: { employeeId: string; role: Role }) {
  const now = useAttendance((s) => s.now)
  const days = useAttendance((s) => s.days)
  const segments = useAttendance((s) => s.segments)
  const people = usePeopleStore((s) => s.employees)
  const today = todayKey()

  const rows = useMemo(() => {
    const team = scopeEmployees(employeeId, role).filter((e) => e.id !== employeeId)
    return team
      .map((e) => {
        const day = days.find((d) => d.employee_id === e.id && d.date === today)
        const segs = day ? segments.filter((s) => s.attendance_day_id === day.id) : []
        return { e, day, status: day?.status ?? 'not_started', work: computeTotals(segs, now).workSeconds }
      })
      .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.e.name.localeCompare(b.e.name))
    // people feeds scopeEmployees(), which reads the store directly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, role, days, segments, now, today, people])

  const shown = rows.slice(0, ROWS)

  return (
    <Card>
      <CardHeader title="Team now" actions={<ViewAll to="/team">{rows.length > ROWS ? `View all ${rows.length}` : 'Open team'}</ViewAll>} />
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No team members" description="People in your team will appear here." className="py-8" />
      ) : (
        <div className="[--sticky-top:0px] [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
          <Table>
            <Thead>
              <Tr className="hover:bg-transparent">
                <Th>Member</Th>
                <Th>Status</Th>
                <Th numeric className="hidden sm:table-cell">Since</Th>
                <Th numeric>Worked</Th>
              </Tr>
            </Thead>
            <Tbody>
              {shown.map(({ e, day, status, work }) => (
                <Tr key={e.id}>
                  <Td className="h-10">
                    <PersonCell name={e.name} presence={presenceTone(status)} />
                  </Td>
                  <Td>
                    <StatusBadge status={status} />
                  </Td>
                  <Td numeric className="hidden text-fg-muted sm:table-cell">
                    {day?.first_in_at ? formatTime(day.first_in_at) : '-'}
                  </Td>
                  <Td numeric>{day?.first_in_at ? formatDuration(work) : '-'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </Card>
  )
}

interface AttentionRow {
  label: string
  count: number
  to: string
  warn?: boolean
}

export function AttentionCard({ role }: { role: Role }) {
  const items = useInboxItems()
  const invoices = useBilling((s) => s.invoices)
  const count = (kind: string) => items.filter((i) => i.kind === kind).length
  const overdue = (invoices ?? []).filter((i) => i.status === 'overdue').length
  const rows: AttentionRow[] = [
    { label: 'Leave requests to review', count: count('leave'), to: '/leave/approvals' },
    { label: 'Regularizations to review', count: count('regularization'), to: '/team/regularizations' },
    { label: 'Claims to review', count: count('claim'), to: '/claims' },
    { label: 'Payroll to review', count: count('payroll'), to: '/payroll' },
    ...(role === 'management' ? [{ label: 'Overdue invoices', count: overdue, to: '/invoices', warn: true }] : []),
  ].filter((r) => r.count > 0)

  return (
    <Card>
      <CardHeader title="Needs your attention" actions={<ViewAll to="/inbox">Open inbox</ViewAll>} />
      {rows.length === 0 ? (
        <EmptyState icon={CheckCheck} title="All clear" description="Nothing is waiting for your decision." className="py-8" />
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.label} className="border-b border-border last:border-b-0">
              <Link
                to={r.to}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
              >
                <span className="flex-1">{r.label}</span>
                <Badge variant={r.warn ? 'danger' : 'accent'} className="font-mono tabular-nums">
                  {r.count}
                </Badge>
                <ChevronRight size={16} className="text-fg-subtle" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function PayrollCard() {
  const { data, latest, previous, latestGross, previousGross } = usePayrollSeries(6)
  const runs = usePayroll((s) => s.runs)
  const label = latest
    ? new Date(latest.year, latest.month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : ''
  const delta = previous && previousGross > 0 ? ((latestGross - previousGross) / previousGross) * 100 : null
  return (
    <Card>
      <CardHeader title="Payroll" actions={<ViewAll to={latest ? `/payroll/${latest.id}` : '/payroll'}>Open payroll</ViewAll>} />
      {latest && runs.length > 0 ? (
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-fg-muted">{label} gross</p>
              <p className="font-mono text-2xl font-semibold tabular-nums">{formatMoney(latestGross)}</p>
              {delta !== null && Math.abs(delta) >= 0.05 && (
                <p className="mt-0.5 text-xs text-fg-muted tabular-nums">
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(1)}% vs last month
                </p>
              )}
            </div>
            <StatusBadge status={latest.status} />
          </div>
          <Bars
            data={data}
            series={[{ name: 'Gross' }]}
            height={96}
            format={(v) => formatMoney(v)}
            aria-label={`Gross payroll, last ${data.length} months`}
          />
        </CardBody>
      ) : (
        <EmptyState title="No payroll runs yet" description="Create a run when the month closes." className="py-8" />
      )}
    </Card>
  )
}

export function BillingCard() {
  const aging = useInvoiceAging()
  const claims = useBilling((s) => s.claims)
  const waiting = (claims ?? []).filter((c) => c.status === 'submitted' || c.status === 'verified').length
  return (
    <Card>
      <CardHeader title="Invoices" actions={<ViewAll to="/invoices">Open invoices</ViewAll>} />
      {aging.length === 0 ? (
        <EmptyState title="Nothing outstanding" description="Sent invoices that are not yet paid will show here." className="py-8" />
      ) : (
        <CardBody className="space-y-5">
          {aging.map((row) => (
            <div key={row.currency}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm text-fg-muted">Outstanding in {row.currency}</span>
                <span className="font-mono text-lg font-semibold tabular-nums">{formatMoney(row.total, row.currency)}</span>
              </div>
              <StackedBar
                segments={row.segments}
                height={8}
                aria-label={`Outstanding ${row.currency} invoices by age`}
                legendClassName="mt-2 gap-x-4"
              />
            </div>
          ))}
          {waiting > 0 && (
            <Link to="/claims" className="flex items-center justify-between border-t border-border pt-3 text-sm hover:text-accent">
              <span>Contractor claims awaiting approval</span>
              <span className="flex items-center gap-1">
                <span className="stat-value font-mono font-medium">{waiting}</span>
                <ChevronRight size={16} className="text-fg-subtle" aria-hidden />
              </span>
            </Link>
          )}
        </CardBody>
      )}
    </Card>
  )
}

export function HiringCard() {
  const { data, total } = useHiresSeries(6)
  if (total === 0) return null
  return (
    <Card>
      <CardHeader title="Hiring" actions={<span className="text-sm text-fg-muted">Last 6 months</span>} />
      <CardBody>
        <Bars
          data={data}
          series={[{ name: 'Hires', color: 'chart-2' }]}
          height={88}
          format={(v) => `${v} ${v === 1 ? 'hire' : 'hires'}`}
          aria-label={`Hires per month, ${total} in the last 6 months`}
        />
      </CardBody>
    </Card>
  )
}

