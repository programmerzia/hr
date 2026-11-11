import { router } from '@inertiajs/react'
import { Fragment, useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { StackedBar, type StackSegment } from '../../components/charts/StackedBar'
import { DurationText } from '../../components/shared/DurationText'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { PageHeader } from '../../components/shared/PageHeader'
import { PersonCell } from '../../components/shared/PersonCell'
import { StatusBadge } from '../../components/shared/StatusBadge'
import {
  Card,
  CardBody,
  NativeSelect,
  Table,
  TableFooter,
  TableToolbar,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui'
import { useAuth, useShared } from '../../inertia/props'
import { formatTime } from '../../lib/format'
import { breakCategoryLabels, presenceTone } from '../../lib/status'
import type { AttendanceDay, Employee, Team, TimeSegment } from '../../types'
import { liveTotals, useServerNow, type DayTotals } from './lib'

/** Row state: the day status, except a working person whose heartbeat went quiet shows as offline (computed server-side). */
type RowState = 'working' | 'offline' | 'on_break' | 'not_started' | 'ended' | 'on_leave'
const statusOrder: RowState[] = ['working', 'offline', 'on_break', 'not_started', 'ended', 'on_leave']
const statusColors: Record<RowState, StackSegment['color']> = {
  working: 'success',
  offline: 'muted',
  on_break: 'warning',
  not_started: 'chart-3',
  ended: 'chart-7',
  on_leave: 'info',
}
const statusFilters: { value: string; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'working', label: 'Working' },
  { value: 'offline', label: 'Offline' },
  { value: 'on_break', label: 'On break' },
  { value: 'not_started', label: 'Not started' },
  { value: 'ended', label: 'Ended' },
  { value: 'on_leave', label: 'On leave' },
]

interface Member {
  employee: Employee
  day: AttendanceDay | null
  open_segment: TimeSegment | null
  presence: RowState
  offline_since: string | null
  totals: DayTotals
  task: { id: string; key: string; title: string } | null
}

interface TeamProps {
  server_time: string
  members: Member[]
  teams: Team[]
}

export default function TeamPage() {
  const role = useAuth().role
  const { members, teams, server_time } = useShared<TeamProps>()
  const now = useServerNow(server_time)
  const [search, setSearch] = useState('')
  const [team, setTeam] = useState('all')
  const [status, setStatus] = useState('all')

  useEffect(() => {
    const id = window.setInterval(() => router.reload({ only: ['members', 'server_time'] }), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const rows = members.map((m) => {
    const st = m.presence
    const open = m.open_segment
    // Only a person who is genuinely working accrues time locally; offline/ended rows keep the server value.
    const totals = st === 'working' ? liveTotals(m.totals, open, server_time, now) : m.totals
    const since =
      st === 'ended' ? m.day?.last_out_at : st === 'working' || st === 'on_break' || st === 'offline' ? open?.started_at : undefined
    return { e: m.employee, day: m.day, st, open, totals, task: m.task, since, offlineSince: m.offline_since }
  })

  const counts = statusOrder.map((s) => ({ s, n: rows.filter((r) => r.st === s).length }))
  const q = search.trim().toLowerCase()
  const grouped = role === 'hr' || role === 'management'
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? 'No team'
  const visible = rows
        .filter((r) => (team === 'all' ? true : r.e.team_id === team))
        .filter((r) => (status === 'all' ? true : r.st === status))
        .filter((r) => !q || r.e.name.toLowerCase().includes(q) || r.e.designation.toLowerCase().includes(q))
        .sort(
          (a, b) =>
            (grouped ? teamName(a.e.team_id).localeCompare(teamName(b.e.team_id)) : 0) ||
            statusOrder.indexOf(a.st) - statusOrder.indexOf(b.st) ||
            a.e.name.localeCompare(b.e.name),
        )

  const showTeamFilter = role !== 'team_lead'
  const labels: Record<string, string> = {
    working: 'Working',
    offline: 'Offline',
    on_break: 'On break',
    not_started: 'Not started',
    ended: 'Ended',
    on_leave: 'On leave',
  }

  return (
    <>
      <PageHeader title="Team" description="Live status for today. Refreshes every 30 seconds." />
      <Card className="mb-4">
        <CardBody>
          <StackedBar
            data-testid="presence-bar"
            segments={counts.map(({ s, n }) => ({ label: labels[s] ?? s, value: n, color: statusColors[s] }))}
            aria-label={`Presence: ${counts.filter((c) => c.n > 0).map((c) => `${c.n} ${(labels[c.s] ?? c.s).toLowerCase()}`).join(', ')}`}
          />
        </CardBody>
      </Card>

      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search people"
        filters={
          <>
            {showTeamFilter && (
              <NativeSelect
                aria-label="Team"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="w-44"
              >
                <option value="all">All teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
            )}
            <NativeSelect
              aria-label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-40"
            >
              {statusFilters.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </NativeSelect>
          </>
        }
      />

      {visible.length === 0 ? (
        <EmptyTable icon={Users} title="No one matches" description="Try a different search or filter." />
      ) : (
        <Table>
          <Thead>
            <Tr className="hover:bg-transparent">
              <Th>Person</Th>
              <Th>Status</Th>
              <Th numeric>Since</Th>
              <Th numeric>Work today</Th>
              <Th>Current task</Th>
              <Th>Late</Th>
            </Tr>
          </Thead>
          <Tbody>
            {visible.map((r, idx) => (
              <Fragment key={r.e.id}>
                {grouped && (idx === 0 || visible[idx - 1]!.e.team_id !== r.e.team_id) && (
                  <Tr className="bg-surface-2/60 hover:bg-surface-2/60">
                    <Td colSpan={6} className="h-8 text-xs font-medium text-fg-muted">
                      {teamName(r.e.team_id)}
                      <span className="ml-2 font-normal text-fg-subtle">
                        {visible.filter((v) => v.e.team_id === r.e.team_id).length}
                      </span>
                    </Td>
                  </Tr>
                )}
              <Tr>
                <Td>
                  <PersonCell name={r.e.name} subtitle={r.e.designation} presence={presenceTone(r.st === 'offline' ? 'ended' : r.st)} />
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-2">
                    <StatusBadge status={r.st} />
                    {r.st === 'offline' && r.offlineSince && (
                      <span className="text-fg-muted">since {formatTime(r.offlineSince)}</span>
                    )}
                    {r.st === 'on_break' && r.open?.break_category && (
                      <span className="text-fg-muted">{breakCategoryLabels[r.open.break_category]}</span>
                    )}
                  </span>
                </Td>
                <Td numeric>{r.since ? formatTime(r.since) : '-'}</Td>
                <Td numeric>
                  {r.day?.first_in_at ? <DurationText seconds={r.totals.work_seconds} /> : '-'}
                </Td>
                <Td className="max-w-64 truncate">
                  {r.task ? (
                    <span>
                      <span className="font-mono text-sm">{r.task.key}</span>{' '}
                      <span className="text-fg-muted">{r.task.title}</span>
                    </span>
                  ) : (
                    <span className="text-fg-subtle">-</span>
                  )}
                </Td>
                <Td>
                  {r.day && r.day.late_minutes > 0 ? (
                    <StatusBadge status="late" label={`Late ${r.day.late_minutes}m`} />
                  ) : (
                    ''
                  )}
                </Td>
              </Tr>
              </Fragment>
            ))}
          </Tbody>
        </Table>
      )}
      <TableFooter count={visible.length} noun={visible.length === 1 ? 'person' : 'people'} />
    </>
  )
}
