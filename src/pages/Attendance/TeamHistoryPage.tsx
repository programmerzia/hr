import { format, subDays } from 'date-fns'
import { CalendarDays, Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DurationText } from '../../components/shared/DurationText'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { PageHeader } from '../../components/shared/PageHeader'
import { PersonCell } from '../../components/shared/PersonCell'
import { StatusBadge } from '../../components/shared/StatusBadge'
import {
  Badge,
  Button,
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
import { formatDate, formatDuration, formatTime } from '../../lib/format'
import { teams } from '../../mock/db/people'
import { useSession } from '../../mock/session'
import { scopeEmployees, useAttendance } from '../../mock/stores/attendance'
import { downloadCsv, totalsOf, useSegmentsByDay } from './lib'

const ROW_LIMIT = 500

export function TeamHistoryPage() {
  const employee = useSession((s) => s.employee)
  const role = useSession((s) => s.role)
  const days = useAttendance((s) => s.days)
  const regs = useAttendance((s) => s.regularizations)
  const now = useAttendance((s) => s.now)
  const segsByDay = useSegmentsByDay()
  const [range, setRange] = useState<DateRange>(() => ({
    from: format(subDays(new Date(), 6), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  }))
  const [team, setTeam] = useState('all')
  const [search, setSearch] = useState('')

  const scope = useMemo(() => (employee && role ? scopeEmployees(employee.id, role) : []), [employee, role])

  const rows = useMemo(() => {
    const byId = new Map(scope.map((e) => [e.id, e]))
    const q = search.trim().toLowerCase()
    return days
      .filter((d) => d.date >= range.from && d.date <= range.to && byId.has(d.employee_id))
      .map((d) => ({ d, e: byId.get(d.employee_id)! }))
      .filter(({ e }) => (team === 'all' ? true : e.team_id === team))
      .filter(({ e }) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => (a.d.date === b.d.date ? a.e.name.localeCompare(b.e.name) : a.d.date < b.d.date ? 1 : -1))
  }, [days, scope, range, team, search])

  const regState = (dayId: string, regularized: boolean) => {
    if (regularized) return 'Approved'
    const r = regs.filter((x) => x.attendance_day_id === dayId)
    if (r.some((x) => x.status === 'pending')) return 'Pending'
    if (r.some((x) => x.status === 'rejected')) return 'Rejected'
    return ''
  }

  const exportCsv = () => {
    const header = ['Date', 'Employee', 'Code', 'Team', 'In', 'Out', 'Work (min)', 'Break (min)', 'Offline (min)', 'Late (min)', 'Status', 'Regularized']
    const body = rows.map(({ d, e }) => {
      const t = totalsOf(segsByDay.get(d.id), now)
      return [
        d.date,
        e.name,
        e.code,
        teams.find((x) => x.id === e.team_id)?.name ?? '',
        d.first_in_at ? formatTime(d.first_in_at) : '',
        d.last_out_at ? formatTime(d.last_out_at) : '',
        Math.round(t.workSeconds / 60),
        Math.round(t.breakSeconds / 60),
        Math.round(t.offlineSeconds / 60),
        d.late_minutes,
        d.status,
        regState(d.id, d.is_regularized),
      ]
    })
    downloadCsv(`attendance-${range.from}-to-${range.to}.csv`, [header, ...body])
  }

  const shown = rows.slice(0, ROW_LIMIT)

  return (
    <>
      <PageHeader
        title="Team history"
        description="Attendance per person per day."
        actions={
          <Button icon={<Download size={16} />} onClick={exportCsv} disabled={rows.length === 0}>
            Export CSV
          </Button>
        }
      />
      <DateRangePicker value={range} onChange={setRange} className="mb-3" />
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search people"
        filters={
          role !== 'team_lead' ? (
            <NativeSelect aria-label="Team" value={team} onChange={(e) => setTeam(e.target.value)} className="w-44">
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
      {shown.length === 0 ? (
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
            {shown.map(({ d, e }) => {
              const t = totalsOf(segsByDay.get(d.id), now)
              const reg = regState(d.id, d.is_regularized)
              return (
                <Tr key={d.id}>
                  <Td>{formatDate(d.date)}</Td>
                  <Td>
                    <PersonCell name={e.name} />
                  </Td>
                  <Td numeric>{d.first_in_at ? formatTime(d.first_in_at) : '-'}</Td>
                  <Td numeric>{d.last_out_at ? formatTime(d.last_out_at) : '-'}</Td>
                  <Td numeric>{d.first_in_at ? <DurationText seconds={t.workSeconds} /> : '-'}</Td>
                  <Td numeric>{d.first_in_at ? formatDuration(t.breakSeconds) : '-'}</Td>
                  <Td numeric>{d.first_in_at && t.offlineSeconds >= 60 ? formatDuration(t.offlineSeconds) : '-'}</Td>
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
      <TableFooter count={rows.length} noun={rows.length === 1 ? 'record' : 'records'}>
        {rows.length > ROW_LIMIT && <span>Showing the first {ROW_LIMIT}. The CSV has all rows.</span>}
      </TableFooter>
    </>
  )
}
