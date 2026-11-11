import { router } from '@inertiajs/react'
import { CalendarDays, Download } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { HeatStrip } from '../../components/charts/HeatStrip'
import { DurationText } from '../../components/shared/DurationText'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { PageHeader } from '../../components/shared/PageHeader'
import { PersonCell } from '../../components/shared/PersonCell'
import { StatusBadge } from '../../components/shared/StatusBadge'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DateRangePicker,
  NativeSelect,
  Table,
  TableFooter,
  TableToolbar,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  type DateRange,
} from '../../components/ui'
import { useAuth, useShared } from '../../inertia/props'
import { formatDate, formatDuration, formatTime } from '../../lib/format'
import type { AttendanceDay, Employee, Team } from '../../types'
import type { DayTotals } from './lib'
import { heatCells, type HeatDay } from './useAttendanceSeries'

interface HistoryRow {
  day: AttendanceDay
  employee: { id: string; name: string; code: string }
  team: string | null
  totals: DayTotals
  regularization: 'Approved' | 'Pending' | 'Rejected' | null
}

interface HistoryProps {
  filters: { from: string; to: string; team: string; employee: string; q: string }
  rows: HistoryRow[]
  total: number
  limit: number
  members: Employee[]
  teams: Team[]
  heat: Record<string, HeatDay[]>
  attendance: { policy: { standard_minutes: number } }
}

function MemberHeat({ name, days, target }: { name: string; days: HeatDay[]; target: number }) {
  const cells = heatCells(days, target)
  const worked = cells.filter((c) => c.value !== null && c.value > 0).length
  return (
    <li className="flex items-center gap-3">
      <span className="w-36 shrink-0 truncate text-sm">{name}</span>
      <HeatStrip cells={cells} height={16} aria-label={`${name}: ${worked} days worked in the last 30 days`} />
    </li>
  )
}

export default function TeamHistoryPage() {
  const role = useAuth().role
  const { filters, rows, total, limit, members, teams, heat, attendance } = useShared<HistoryProps>()
  const [search, setSearch] = useState(filters.q)
  const target = attendance.policy.standard_minutes * 60

  const visit = (patch: Partial<HistoryProps['filters']>) => {
    const next = { ...filters, ...patch }
    router.get(route('attendance.team.history'), { ...next, team: next.team === 'all' ? undefined : next.team, employee: next.employee === 'all' ? undefined : next.employee, q: next.q || undefined }, { preserveState: true, preserveScroll: true, replace: true, only: ['filters', 'rows', 'total', 'members', 'heat'] })
  }
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const id = window.setTimeout(() => visit({ q: search.trim() }), 300)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const range: DateRange = { from: filters.from, to: filters.to }
  const exportHref = route('attendance.team.history.csv', {
    from: filters.from,
    to: filters.to,
    team: filters.team === 'all' ? undefined : filters.team,
    employee: filters.employee === 'all' ? undefined : filters.employee,
    q: filters.q || undefined,
  })

  return (
    <>
      <PageHeader
        title="Team history"
        description="Attendance per person per day."
        actions={
          <a href={exportHref} download aria-disabled={rows.length === 0}>
            <Button icon={<Download size={16} />} disabled={rows.length === 0}>
              Export CSV
            </Button>
          </a>
        }
      />
      <DateRangePicker value={range} onChange={(r) => visit({ from: r.from, to: r.to })} className="mb-3" />
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search people"
        filters={
          role !== 'team_lead' ? (
            <NativeSelect aria-label="Team" value={filters.team} onChange={(e) => visit({ team: e.target.value })} className="w-44">
              <option value="all">All teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          ) : undefined
        }
      />
      {members.length > 0 && (
        <Card className="mb-4">
          <CardHeader
            title="Last 30 days"
            actions={
              <span className="flex items-center gap-1.5 text-xs text-fg-muted">
                Less
                <span className="size-2.5 rounded-sm bg-success/25" aria-hidden />
                <span className="size-2.5 rounded-sm bg-success/60" aria-hidden />
                <span className="size-2.5 rounded-sm bg-success" aria-hidden />
                Full day
                <span className="ml-2 size-2.5 rounded-sm bg-danger/20" aria-hidden />
                No record
              </span>
            }
          />
          <ul className="grid gap-x-8 gap-y-2.5 p-4 lg:grid-cols-2" data-testid="heat-strips">
            {members.map((e) => (
              <MemberHeat key={e.id} name={e.name} days={heat[e.id] ?? []} target={target} />
            ))}
          </ul>
        </Card>
      )}
      {rows.length === 0 ? (
        <EmptyTable icon={CalendarDays} title="No records" description="Nothing was recorded for this range and filter." />
      ) : (
        <Table>
          <Thead>
            <Tr className="hover:bg-transparent">
              <Th>Date</Th>
              <Th>Person</Th>
              <Th numeric>In</Th>
              <Th numeric>Out</Th>
              <Th numeric>Work</Th>
              <Th numeric>Break</Th>
              <Th numeric>Offline</Th>
              <Th numeric>Late (min)</Th>
              <Th>Status</Th>
              <Th>Regularized</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((r) => {
              const d = r.day
              const t = r.totals
              const reg = r.regularization
              return (
                <Tr key={d.id}>
                  <Td>{formatDate(d.date)}</Td>
                  <Td>
                    <PersonCell name={r.employee.name} />
                  </Td>
                  <Td numeric>{d.first_in_at ? formatTime(d.first_in_at) : '-'}</Td>
                  <Td numeric>{d.last_out_at ? formatTime(d.last_out_at) : '-'}</Td>
                  <Td numeric>{d.first_in_at ? <DurationText seconds={t.work_seconds} /> : '-'}</Td>
                  <Td numeric>{d.first_in_at ? formatDuration(t.break_seconds) : '-'}</Td>
                  <Td numeric>{d.first_in_at && t.offline_seconds >= 60 ? formatDuration(t.offline_seconds) : '-'}</Td>
                  <Td numeric>{d.late_minutes > 0 ? d.late_minutes : '-'}</Td>
                  <Td>
                    <StatusBadge status={d.status} />
                  </Td>
                  <Td>
                    {reg === 'Approved' ? (
                      <Badge variant="success">Yes</Badge>
                    ) : reg === 'Pending' ? (
                      <StatusBadge status="pending" />
                    ) : reg === 'Rejected' ? (
                      <StatusBadge status="rejected" />
                    ) : (
                      <span className="text-fg-subtle">-</span>
                    )}
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      )}
      <TableFooter count={total} noun={total === 1 ? 'record' : 'records'}>
        {total > limit && <span>Showing the first {limit}. The CSV has all rows.</span>}
      </TableFooter>
    </>
  )
}
