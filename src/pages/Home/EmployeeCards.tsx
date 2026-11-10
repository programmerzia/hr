import { Coffee, LogOut, MessageSquare, Play } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Clock } from '../../components/shared/Clock'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { TaskKey } from '../../components/shared/TaskKey'
import { TimelineBar } from '../../components/shared/TimelineBar'
import { Button, Card, CardBody, CardHeader, EmptyState, toast } from '../../components/ui'
import { formatDate, formatTime } from '../../lib/format'
import { attendancePolicy, shiftTime } from '../../mock/db/attendance'
import { useAttendance, computeTotals, todayKey } from '../../mock/stores/attendance'
import { useChat } from '../../mock/stores/chat'
import { useLeaveStore } from '../../mock/stores/leave'
import { useMyTasks } from '../../mock/stores/work'

export function TodayCard({ employeeId }: { employeeId: string }) {
  const now = useAttendance((s) => s.now)
  const days = useAttendance((s) => s.days)
  const allSegments = useAttendance((s) => s.segments)
  const startWork = useAttendance((s) => s.startWork)
  const startBreak = useAttendance((s) => s.startBreak)
  const endDay = useAttendance((s) => s.endDay)
  const today = todayKey()
  const day = useMemo(() => days.find((d) => d.employee_id === employeeId && d.date === today), [days, employeeId, today])
  const segments = useMemo(
    () => (day ? allSegments.filter((s) => s.attendance_day_id === day.id) : []),
    [allSegments, day],
  )
  const totals = computeTotals(segments, now)
  const status = day?.status ?? 'not_started'
  const rangeStart = shiftTime(today, attendancePolicy.shift_start).toISOString()
  const rangeEnd = shiftTime(today, attendancePolicy.shift_end).toISOString()
  const canAct = status === 'not_started' || status === 'working' || status === 'on_break'

  return (
    <Card>
      <CardHeader title="Today" actions={<StatusBadge status={status} />} />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Clock seconds={totals.workSeconds} />
            <p className="text-sm text-fg-muted">
              Worked today{day?.first_in_at ? `, started ${formatTime(day.first_in_at)}` : ''}
            </p>
          </div>
          {canAct && (
            <div className="flex flex-wrap gap-2">
              {status !== 'working' && (
                <Button
                  variant="primary"
                  icon={<Play size={16} />}
                  onClick={() => {
                    const r = startWork(employeeId)
                    if (r === 'needs_overtime_confirm') toast.error('Your day has ended. Open My day to start overtime.')
                  }}
                >
                  {status === 'on_break' ? 'Resume work' : 'Start work'}
                </Button>
              )}
              {status === 'working' && (
                <Button icon={<Coffee size={16} />} onClick={() => startBreak(employeeId, 'short')}>
                  Take a break
                </Button>
              )}
              {status !== 'not_started' && (
                <Button icon={<LogOut size={16} />} onClick={() => endDay(employeeId)}>
                  End day
                </Button>
              )}
            </div>
          )}
        </div>
        <TimelineBar segments={segments} rangeStart={rangeStart} rangeEnd={rangeEnd} />
        <Link to="/my-day" className="text-sm text-accent hover:underline">
          Open my day
        </Link>
      </CardBody>
    </Card>
  )
}

export function MyTasksCard() {
  const tasks = useMyTasks()
  const top = useMemo(
    () =>
      [...tasks]
        .sort((a, b) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999') || a.number - b.number)
        .slice(0, 6),
    [tasks],
  )
  const today = todayKey()
  return (
    <Card>
      <CardHeader
        title="My tasks"
        actions={
          <Link to="/tasks" className="text-sm text-accent hover:underline">
            View all
          </Link>
        }
      />
      {top.length === 0 ? (
        <EmptyState title="No open tasks" description="Tasks assigned to you will appear here." className="py-8" />
      ) : (
        <ul>
          {top.map((t) => (
            <li key={t.id} className="flex items-center gap-3 border-b border-border px-4 py-2 last:border-b-0">
              <TaskKey taskKey={t.key} className="w-20 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              {t.due_on && (
                <span className={t.due_on < today ? 'shrink-0 text-sm text-danger' : 'shrink-0 text-sm text-fg-muted'}>
                  {t.due_on < today ? 'Overdue ' : 'Due '}
                  {formatDate(t.due_on)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function LeaveBalancesCard({ employeeId }: { employeeId: string }) {
  useLeaveStore((s) => s.balances)
  const balances = useLeaveStore.getState().balancesFor(employeeId, new Date().getFullYear())
  const shown = balances.filter((b) => !b.unlimited)
  return (
    <Card>
      <CardHeader
        title="Leave balance"
        actions={
          <Link to="/leave" className="text-sm text-accent hover:underline">
            Request leave
          </Link>
        }
      />
      {shown.length === 0 ? (
        <EmptyState title="No leave balances" description="Your balances will show once leave types are set up." className="py-8" />
      ) : (
        <ul>
          {shown.map((b) => (
            <li key={b.id} className="flex items-center justify-between border-b border-border px-4 py-2 last:border-b-0">
              <span>{b.type.name}</span>
              <span className="font-mono tabular-nums">
                {b.available}
                <span className="text-fg-muted"> of {b.entitled} days</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function ChatCard({ employeeId }: { employeeId: string }) {
  const unread = useChat((s) => s.totalUnread(employeeId))
  return (
    <Card>
      <CardHeader title="Chat" />
      <CardBody className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-fg-muted" aria-hidden />
          <span>{unread === 0 ? 'No unread messages' : `${unread} unread ${unread === 1 ? 'message' : 'messages'}`}</span>
        </div>
        <Link to="/chat" className="text-sm text-accent hover:underline">
          Open chat
        </Link>
      </CardBody>
    </Card>
  )
}
