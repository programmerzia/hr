import { Link } from '@inertiajs/react'
import { CheckCheck, ChevronRight, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Bars, type BarDatum } from '../../components/charts/Bars'
import { StackedBar, type StackSegment } from '../../components/charts/StackedBar'
import { PersonCell } from '../../components/shared/PersonCell'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Badge, Card, CardBody, CardHeader, EmptyState, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { useShared } from '../../inertia/props'
import { formatDuration, formatMoney, formatTime } from '../../lib/format'
import { presenceTone } from '../../lib/status'
import type { Currency } from '../../types'

const ROWS = 8

function ViewAll({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link href={to} className="text-sm text-accent hover:underline">
      {children}
    </Link>
  )
}

interface Overview {
  title: string
  total: number
  counts: { working: number; break: number; offline: number; leave: number; ended: number; not_started: number; absent: number }
  facts: { label: string; value: number }[]
}

/** One wide presence card: a composition bar plus a few inline facts. */
export function OverviewCard() {
  const { overview } = useShared<{ overview: Overview }>()
  const { title, total, counts: n, facts } = overview
  const segments: StackSegment[] = [
    { label: 'Working', value: n.working, color: 'success' },
    { label: 'On break', value: n.break, color: 'warning' },
    { label: 'Offline', value: n.offline, color: 'muted' },
    { label: 'On leave', value: n.leave, color: 'info' },
    { label: 'Day ended', value: n.ended, color: 'chart-7' },
    { label: 'Not started', value: n.not_started, color: 'chart-3' },
    { label: 'Absent', value: n.absent, color: 'danger' },
  ]

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

interface TeamRow {
  id: string
  name: string
  status: string
  first_in_at: string | null
  work_seconds: number
}

export function TeamNowCard() {
  const { team_now: rows } = useShared<{ team_now: TeamRow[] }>()
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
              {shown.map((m) => (
                <Tr key={m.id}>
                  <Td className="h-10">
                    <PersonCell name={m.name} presence={presenceTone(m.status)} />
                  </Td>
                  <Td>
                    <StatusBadge status={m.status} />
                  </Td>
                  <Td numeric className="hidden text-fg-muted sm:table-cell">
                    {m.first_in_at ? formatTime(m.first_in_at) : '-'}
                  </Td>
                  <Td numeric>{m.first_in_at ? formatDuration(m.work_seconds) : '-'}</Td>
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

export function AttentionCard() {
  const { attention: rows } = useShared<{ attention: AttentionRow[] }>()
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
                href={r.to}
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

interface PayrollSummary {
  series: { label: string; value: number }[]
  latest: { id: string; year: number; month: number; status: string }
  latest_gross: number
  previous_gross: number
}

export function PayrollCard() {
  const { payroll } = useShared<{ payroll: PayrollSummary | null }>()
  const latest = payroll?.latest
  const latestGross = payroll?.latest_gross ?? 0
  const previousGross = payroll?.previous_gross ?? 0
  const data: BarDatum[] = (payroll?.series ?? []).map((p, i, all) => ({
    label: p.label,
    values: [p.value],
    active: i === all.length - 1 ? true : undefined,
  }))
  const label = latest ? new Date(latest.year, latest.month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }) : ''
  const delta = previousGross > 0 ? ((latestGross - previousGross) / previousGross) * 100 : null
  return (
    <Card>
      <CardHeader title="Payroll" actions={<ViewAll to={latest ? `/payroll/${latest.id}` : '/payroll'}>Open payroll</ViewAll>} />
      {latest ? (
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

interface BillingSummary {
  aging: { currency: Currency; total: number; buckets: number[] }[]
  claims_waiting: number
}

const agingLabels: [string, StackSegment['color']][] = [
  ['Current', 'chart-6'],
  ['1-30 days late', 'chart-4'],
  ['31-60 days late', 'chart-8'],
  ['Over 60 days late', 'chart-5'],
]

export function BillingCard() {
  const { billing } = useShared<{ billing: BillingSummary | null }>()
  const waiting = billing?.claims_waiting ?? 0
  const aging = (billing?.aging ?? []).map((row) => ({
    currency: row.currency,
    total: row.total,
    segments: agingLabels.map(([label, color], i) => ({
      label,
      color,
      value: row.buckets[i] ?? 0,
      display: formatMoney(row.buckets[i] ?? 0, row.currency),
    })),
  }))
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
            <Link href="/claims" className="flex items-center justify-between border-t border-border pt-3 text-sm hover:text-accent">
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
  const { hiring } = useShared<{ hiring: { data: { label: string; value: number }[]; total: number } | null }>()
  const total = hiring?.total ?? 0
  const data: BarDatum[] = (hiring?.data ?? []).map((d, i, all) => ({
    label: d.label,
    values: [d.value],
    active: i === all.length - 1 ? true : undefined,
  }))
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

