import { useMemo } from 'react'
import { Link } from 'react-router'
import { PersonCell } from '../../components/shared/PersonCell'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Card, CardBody, CardHeader, EmptyState, Stat, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { formatDuration, formatMoney, formatTime } from '../../lib/format'
import { useInboxItems } from '../../mock/stores/inbox'
import { listOf, useOptionalState } from '../../mock/optional'
import { computeTotals, scopeEmployees, todayKey, useAttendance } from '../../mock/stores/attendance'
import { usePeopleStore } from '../../mock/stores/people'
import type { ContractorClaim, Currency, Invoice, PayrollRun, Role } from '../../types'

export function TeamNowCard({ employeeId, role }: { employeeId: string; role: Role }) {
  const now = useAttendance((s) => s.now)
  const days = useAttendance((s) => s.days)
  const segments = useAttendance((s) => s.segments)
  const people = usePeopleStore((s) => s.employees)
  const today = todayKey()

  const rows = useMemo(() => {
    const team = scopeEmployees(employeeId, role).filter((e) => e.id !== employeeId)
    return team.map((e) => {
      const day = days.find((d) => d.employee_id === e.id && d.date === today)
      const segs = day ? segments.filter((s) => s.attendance_day_id === day.id) : []
      return { e, day, work: computeTotals(segs, now).workSeconds }
    })
    // people feeds scopeEmployees(), which reads the store directly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, role, days, segments, now, today, people])

  return (
    <Card>
      <CardHeader
        title="Team now"
        actions={
          <Link to="/team" className="text-sm text-accent hover:underline">
            Open team
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No team members" description="People in your team will appear here." className="py-8" />
      ) : (
        <div className="max-h-96 overflow-auto">
          <Table>
            <Thead>
              <Tr>
                <Th>Member</Th>
                <Th>Status</Th>
                <Th>Since</Th>
                <Th numeric>Worked</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map(({ e, day, work }) => (
                <Tr key={e.id}>
                  <Td>
                    <PersonCell name={e.name} />
                  </Td>
                  <Td>
                    <StatusBadge status={day?.status ?? 'not_started'} />
                  </Td>
                  <Td>{day?.first_in_at ? formatTime(day.first_in_at) : 'None'}</Td>
                  <Td numeric>{formatDuration(work)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </Card>
  )
}

export function AttentionCard() {
  const items = useInboxItems()
  const leave = items.filter((i) => i.kind === 'leave').length
  const regs = items.filter((i) => i.kind === 'regularization').length
  const other = items.filter((i) => i.kind === 'claim' || i.kind === 'payroll').length
  const total = leave + regs + other
  const rows = [
    { label: 'Leave requests to review', count: leave },
    { label: 'Regularizations to review', count: regs },
    ...(other > 0 ? [{ label: 'Claims and payroll to review', count: other }] : []),
  ]
  return (
    <Card>
      <CardHeader
        title="Needs your attention"
        actions={
          <Link to="/inbox" className="text-sm text-accent hover:underline">
            Open inbox
          </Link>
        }
      />
      {total === 0 ? (
        <EmptyState title="All clear" description="Nothing is waiting for your decision." className="py-8" />
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between border-b border-border px-4 py-2 last:border-b-0">
              <span>{r.label}</span>
              <span className="font-mono font-medium tabular-nums">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function PeopleStats() {
  const people = usePeopleStore((s) => s.employees)
  const stats = useMemo(() => {
    const current = people.filter((p) => p.exited_on === null)
    const month = new Date().toISOString().slice(0, 7)
    return {
      headcount: current.length,
      probation: current.filter((p) => p.status === 'probation').length,
      onLeave: current.filter((p) => p.status === 'on_leave').length,
      joining: people.filter((p) => p.joined_on.startsWith(month)).length,
    }
  }, [people])
  return (
    <section aria-label="People" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Headcount" value={stats.headcount} />
      <Stat label="On probation" value={stats.probation} />
      <Stat label="Marked on leave" value={stats.onLeave} />
      <Stat label="Joining this month" value={stats.joining} />
    </section>
  )
}

export function PayrollCard() {
  const payroll = useOptionalState('payroll')
  const runs = listOf<PayrollRun>(payroll, 'runs')
  if (!runs) return null
  const latest = [...runs].sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month))[0]
  const label = latest
    ? new Date(latest.year, latest.month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : ''
  return (
    <Card>
      <CardHeader
        title="Payroll"
        actions={
          <Link to={latest ? `/payroll/${latest.id}` : '/payroll'} className="text-sm text-accent hover:underline">
            Open payroll
          </Link>
        }
      />
      {latest ? (
        <CardBody className="flex items-center justify-between gap-3">
          <span>{label} run</span>
          <StatusBadge status={latest.status} />
        </CardBody>
      ) : (
        <EmptyState title="No payroll runs yet" description="Create a run when the month closes." className="py-8" />
      )}
    </Card>
  )
}

export function CompanyStats() {
  const people = usePeopleStore((s) => s.employees)
  const days = useAttendance((s) => s.days)
  const today = todayKey()
  const counts = useMemo(() => {
    const active = new Set(people.filter((p) => p.exited_on === null).map((p) => p.id))
    const todays = days.filter((d) => d.date === today && active.has(d.employee_id))
    const n = (...s: string[]) => todays.filter((d) => s.includes(d.status)).length
    return { working: n('working'), onBreak: n('on_break'), leave: n('on_leave'), absent: n('absent') }
  }, [people, days, today])
  return (
    <section aria-label="Company today" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Working now" value={counts.working} />
      <Stat label="On break" value={counts.onBreak} />
      <Stat label="On leave" value={counts.leave} />
      <Stat label="Absent" value={counts.absent} />
    </section>
  )
}

export function FinanceStats() {
  const billing = useOptionalState('billing')
  const invoices = listOf<Invoice>(billing, 'invoices')
  const claims = listOf<ContractorClaim>(billing, 'claims')
  if (!invoices && !claims) return null

  const open = (invoices ?? []).filter((i) => i.status === 'sent' || i.status === 'overdue')
  const overdue = (invoices ?? []).filter((i) => i.status === 'overdue')
  const byCurrency = new Map<Currency, number>()
  for (const i of open) byCurrency.set(i.currency, (byCurrency.get(i.currency) ?? 0) + i.total - i.paid_total)
  const amounts = [...byCurrency].map(([c, v]) => formatMoney(v, c)).join(' and ')
  const waiting = (claims ?? []).filter((c) => c.status === 'submitted' || c.status === 'verified').length

  return (
    <section aria-label="Finance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {invoices && (
        <>
          <Link to="/invoices" className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
            <Stat label="Invoices outstanding" value={open.length} delta={amounts ? { value: amounts } : undefined} />
          </Link>
          <Link to="/invoices" className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
            <Stat
              label="Invoices overdue"
              value={overdue.length}
              delta={overdue.length > 0 ? { value: 'Follow up with clients', tone: 'danger' } : undefined}
            />
          </Link>
        </>
      )}
      {claims && (
        <Link to="/claims" className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
          <Stat label="Claims awaiting approval" value={waiting} />
        </Link>
      )}
    </section>
  )
}
