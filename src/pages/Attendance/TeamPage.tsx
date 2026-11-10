import { Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DurationText } from '../../components/shared/DurationText'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { PageHeader } from '../../components/shared/PageHeader'
import { PersonCell } from '../../components/shared/PersonCell'
import { StatusBadge } from '../../components/shared/StatusBadge'
import {
  NativeSelect,
  Stat,
  Table,
  TableFooter,
  TableToolbar,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui'
import { formatTime } from '../../lib/format'
import { breakCategoryLabels } from '../../lib/status'
import { dateKey } from '../../mock/db/attendance'
import { teams } from '../../mock/db/people'
import { useSession } from '../../mock/session'
import { scopeEmployees, useAttendance } from '../../mock/stores/attendance'
import type { AttendanceDayStatus, Employee, Role } from '../../types'
import { totalsOf, useSegmentsByDay } from './lib'
import { useWorkTasks } from './useMyTasks'

const statusOrder: AttendanceDayStatus[] = ['working', 'on_break', 'not_started', 'ended', 'on_leave']
const statusFilters: { value: string; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'working', label: 'Working' },
  { value: 'on_break', label: 'On break' },
  { value: 'not_started', label: 'Not started' },
  { value: 'ended', label: 'Ended' },
  { value: 'on_leave', label: 'On leave' },
]

export function TeamPage() {
  const employee = useSession((s) => s.employee)
  const role = useSession((s) => s.role)
  if (!employee || !role) return null
  return <Team viewer={employee} role={role} />
}

function Team({ viewer, role }: { viewer: Employee; role: Role }) {
  const now = useAttendance((s) => s.now)
  const days = useAttendance((s) => s.days)
  const entries = useAttendance((s) => s.taskTimeEntries)
  const segsByDay = useSegmentsByDay()
  const tasks = useWorkTasks()
  const [search, setSearch] = useState('')
  const [team, setTeam] = useState('all')
  const [status, setStatus] = useState('all')

  const scope = useMemo(() => scopeEmployees(viewer.id, role), [viewer.id, role])
  const today = dateKey(new Date(now))

  const rows = scope.map((e) => {
    const day = days.find((d) => d.employee_id === e.id && d.date === today)
    const st: AttendanceDayStatus =
      day?.status === 'holiday' || day?.status === 'absent' || !day ? 'not_started' : day.status
    const segs = (day && segsByDay.get(day.id)) || []
    const open = segs.find((s) => s.ended_at === null)
    const totals = totalsOf(segs, now)
    const entry = entries.find((x) => x.employee_id === e.id && x.ended_at === null)
    const task = entry ? tasks.find((t) => t.id === entry.task_id) : undefined
    const since =
      st === 'ended'
        ? day?.last_out_at
        : st === 'working' || st === 'on_break'
          ? open?.started_at
          : undefined
    return { e, day, st, open, totals, task, taskId: entry?.task_id, since }
  })

  const counts = statusOrder.map((s) => ({ s, n: rows.filter((r) => r.st === s).length }))
  const q = search.trim().toLowerCase()
  const visible = rows
    .filter((r) => (team === 'all' ? true : r.e.team_id === team))
    .filter((r) => (status === 'all' ? true : r.st === status))
    .filter((r) => !q || r.e.name.toLowerCase().includes(q) || r.e.designation.toLowerCase().includes(q))
    .sort((a, b) => statusOrder.indexOf(a.st) - statusOrder.indexOf(b.st) || a.e.name.localeCompare(b.e.name))

  const showTeamFilter = role !== 'team_lead'
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? '-'
  const labels: Record<string, string> = {
    working: 'Working',
    on_break: 'On break',
    not_started: 'Not started',
    ended: 'Ended',
    on_leave: 'On leave',
  }

  return (
    <>
      <PageHeader title="Team" description="Live status for today. Updates every second." />
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-5">
        {counts.map(({ s, n }) => (
          <Stat key={s} label={labels[s]} value={n} />
        ))}
      </div>

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
              {showTeamFilter && <Th>Team</Th>}
              <Th>Status</Th>
              <Th numeric>Since</Th>
              <Th numeric>Work today</Th>
              <Th>Current task</Th>
              <Th>Late</Th>
            </Tr>
          </Thead>
          <Tbody>
            {visible.map((r) => (
              <Tr key={r.e.id}>
                <Td>
                  <PersonCell name={r.e.name} subtitle={r.e.designation} />
                </Td>
                {showTeamFilter && <Td className="text-fg-muted">{teamName(r.e.team_id)}</Td>}
                <Td>
                  <span className="inline-flex items-center gap-2">
                    <StatusBadge status={r.st} />
                    {r.st === 'on_break' && r.open?.break_category && (
                      <span className="text-fg-muted">{breakCategoryLabels[r.open.break_category]}</span>
                    )}
                  </span>
                </Td>
                <Td numeric>{r.since ? formatTime(r.since) : '-'}</Td>
                <Td numeric>
                  {r.day?.first_in_at ? <DurationText seconds={r.totals.workSeconds} /> : '-'}
                </Td>
                <Td className="max-w-64 truncate">
                  {r.task ? (
                    <span>
                      <span className="font-mono text-sm">{r.task.key}</span>{' '}
                      <span className="text-fg-muted">{r.task.title}</span>
                    </span>
                  ) : r.taskId ? (
                    <span className="font-mono text-sm">{r.taskId}</span>
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
            ))}
          </Tbody>
        </Table>
      )}
      <TableFooter count={visible.length} noun={visible.length === 1 ? 'person' : 'people'} />
    </>
  )
}
