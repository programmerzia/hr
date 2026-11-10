import { addDays, format, startOfWeek } from 'date-fns'
import { Coffee, LogOut, Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Clock } from '../../components/shared/Clock'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { DurationText } from '../../components/shared/DurationText'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { TimelineBar } from '../../components/shared/TimelineBar'
import {
  Badge,
  Button,
  Card,
  CardBody,
  Select,
  toast,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui'
import { formatDate, formatDuration, formatTime } from '../../lib/format'
import { breakCategoryLabels } from '../../lib/status'
import { attendancePolicy, dateKey, isHoliday, isWeekend, shiftTime } from '../../mock/db/attendance'
import { useSession } from '../../mock/session'
import { useAttendance } from '../../mock/stores/attendance'
import type { AttendanceDay, TimeSegment } from '../../types'
import { BreakDialog } from './BreakDialog'
import { totalsOf, useSegmentsByDay } from './lib'
import { ReasonDialog } from './RegularizeDialog'
import { useMyTasks } from './useMyTasks'

const NO_TASK = 'none'

export function MyDayPage() {
  const employee = useSession((s) => s.employee)
  if (!employee) return null
  return <MyDay employeeId={employee.id} />
}

function MyDay({ employeeId }: { employeeId: string }) {
  const now = useAttendance((s) => s.now)
  const days = useAttendance((s) => s.days)
  const regs = useAttendance((s) => s.regularizations)
  const currentTask = useAttendance((s) => s.currentTask[employeeId] ?? null)
  const startWork = useAttendance((s) => s.startWork)
  const startBreak = useAttendance((s) => s.startBreak)
  const endDay = useAttendance((s) => s.endDay)
  const setCurrentTask = useAttendance((s) => s.setCurrentTask)
  const requestRegularization = useAttendance((s) => s.requestRegularization)
  const taskSecondsFor = useAttendance((s) => s.taskSecondsFor)
  const segsByDay = useSegmentsByDay()
  const myTasks = useMyTasks(employeeId)

  const [breakOpen, setBreakOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [overtimeOpen, setOvertimeOpen] = useState(false)
  const [regDay, setRegDay] = useState<AttendanceDay | null>(null)

  const today = dateKey(new Date(now))
  const day = days.find((d) => d.employee_id === employeeId && d.date === today)
  const status = day?.status ?? 'not_started'
  const segs = (day && segsByDay.get(day.id)) || []
  const totals = totalsOf(segs, now)
  const openSeg = segs.find((s) => s.ended_at === null)

  const shiftStart = shiftTime(new Date(now), attendancePolicy.shift_start)
  const firstIn = day?.first_in_at ? new Date(day.first_in_at) : null
  const rangeStart = firstIn && firstIn < shiftStart ? firstIn : shiftStart
  const rangeEnd = new Date(Math.max(now, rangeStart.getTime() + 3_600_000))

  const sinceText =
    status === 'working' && openSeg
      ? `Working since ${formatTime(openSeg.started_at)}`
      : status === 'on_break' && openSeg
        ? `${breakCategoryLabels[openSeg.break_category ?? 'short']} since ${formatTime(openSeg.started_at)}`
        : status === 'ended' && day?.last_out_at
          ? `Ended at ${formatTime(day.last_out_at)}`
          : status === 'not_started'
            ? 'You have not started yet today'
            : ''

  const taskOptions = [
    { value: NO_TASK, label: 'No task' },
    ...myTasks.map((t) => ({ value: t.id, label: `${t.key}  ${t.title}` })),
  ]
  const selectedTask = currentTask && myTasks.some((t) => t.id === currentTask) ? currentTask : null

  const week = useMemo(() => {
    const start = startOfWeek(new Date(now))
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [now])

  const startOrResume = () => {
    const r = startWork(employeeId)
    if (r === 'needs_overtime_confirm') setOvertimeOpen(true)
  }

  return (
    <>
      <PageHeader title="My day" description={formatDate(new Date(now))} />

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={status} />
                {day && day.late_minutes > 0 && (
                  <StatusBadge status="late" label={`Late ${day.late_minutes}m`} />
                )}
                {segs.some((s) => s.note === 'Overtime session') && <Badge variant="info">Overtime</Badge>}
              </div>
              <div className="mt-2">
                <Clock seconds={totals.workSeconds} />
              </div>
              <p className="mt-1 text-sm text-fg-muted">
                {sinceText}
                {sinceText && ' · '}
                Break <DurationText seconds={totals.breakSeconds} /> · Target{' '}
                {formatDuration(attendancePolicy.standard_minutes * 60)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {status === 'working' && (
                <Button icon={<Coffee size={16} />} onClick={() => setBreakOpen(true)}>
                  Take a break
                </Button>
              )}
              {status === 'on_break' && (
                <Button variant="primary" icon={<Play size={16} />} onClick={startOrResume}>
                  Resume
                </Button>
              )}
              {(status === 'not_started' || status === 'on_leave' || status === 'absent' || status === 'holiday') && (
                <Button variant="primary" icon={<Play size={16} />} onClick={startOrResume}>
                  Start work
                </Button>
              )}
              {status === 'ended' && (
                <Button icon={<Play size={16} />} onClick={startOrResume}>
                  Start overtime
                </Button>
              )}
              {(status === 'working' || status === 'on_break') && (
                <Button icon={<LogOut size={16} />} onClick={() => setEndOpen(true)}>
                  End my day
                </Button>
              )}
            </div>
          </div>

          <TimelineBar segments={segs} rangeStart={rangeStart.toISOString()} rangeEnd={rangeEnd.toISOString()} />

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <span className="text-sm font-medium">Current task</span>
            <Select
              aria-label="Current task"
              className="w-full sm:w-80"
              value={selectedTask ?? NO_TASK}
              onValueChange={(v) => setCurrentTask(employeeId, v === NO_TASK ? null : v)}
              options={taskOptions}
              disabled={taskOptions.length === 1}
              placeholder="No task"
            />
            <span className="text-sm text-fg-muted">
              {taskOptions.length === 1
                ? 'No tasks are assigned to you.'
                : selectedTask
                  ? status === 'working'
                    ? `Tracked today: ${formatDuration(taskSecondsFor(employeeId, selectedTask, now))}`
                    : 'Time is tracked while you are working.'
                  : 'Time without a task is unallocated.'}
            </span>
          </div>
        </CardBody>
      </Card>

      <section className="mt-6" aria-labelledby="today-h">
        <h2 id="today-h" className="mb-2 text-lg font-semibold">
          Today
        </h2>
        {segs.length === 0 ? (
          <EmptyTable title="Nothing recorded yet" description="Segments appear here once you start work." />
        ) : (
          <SegmentsTable segs={segs} now={now} />
        )}
        {totals.lunchOverCapMinutes > 0 && (
          <p className="mt-2 text-sm text-warning">
            Lunch is {totals.lunchOverCapMinutes}m over the {attendancePolicy.lunch_cap_minutes}m cap.
          </p>
        )}
      </section>

      <section className="mt-6" aria-labelledby="week-h">
        <h2 id="week-h" className="mb-2 text-lg font-semibold">
          This week
        </h2>
        <Table>
          <Thead>
            <Tr className="hover:bg-transparent">
              <Th>Day</Th>
              <Th numeric>In</Th>
              <Th numeric>Out</Th>
              <Th numeric>Work</Th>
              <Th numeric>Break</Th>
              <Th numeric>Late</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {week.map((d) => {
              const key = dateKey(d)
              const rec = days.find((x) => x.employee_id === employeeId && x.date === key)
              const t = totalsOf(rec && segsByDay.get(rec.id), now)
              const off = isWeekend(d) ? 'Weekend' : isHoliday(key) ? 'Holiday' : null
              const pending = rec && regs.some((r) => r.attendance_day_id === rec.id && r.status === 'pending')
              const rejected = rec && regs.some((r) => r.attendance_day_id === rec.id && r.status === 'rejected')
              return (
                <Tr key={key} className={key === today ? 'bg-accent-soft/40' : undefined}>
                  <Td>{format(d, 'EEE d MMM')}</Td>
                  <Td numeric>{rec?.first_in_at ? formatTime(rec.first_in_at) : '-'}</Td>
                  <Td numeric>{rec?.last_out_at ? formatTime(rec.last_out_at) : '-'}</Td>
                  <Td numeric>{rec && rec.first_in_at ? formatDuration(t.workSeconds) : '-'}</Td>
                  <Td numeric>{rec && rec.first_in_at ? formatDuration(t.breakSeconds) : '-'}</Td>
                  <Td numeric>{rec && rec.late_minutes > 0 ? `${rec.late_minutes}m` : '-'}</Td>
                  <Td>
                    {rec ? (
                      <StatusBadge status={rec.status} />
                    ) : off ? (
                      <StatusBadge status="holiday" label={off} />
                    ) : (
                      <span className="text-fg-subtle">-</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    {rec && rec.late_minutes > 0 && (
                      <span className="inline-flex items-center gap-2">
                        {rec.is_regularized ? (
                          <Badge variant="success">Regularized</Badge>
                        ) : pending ? (
                          <StatusBadge status="pending" label="Regularization pending" />
                        ) : (
                          <>
                            {rejected && <StatusBadge status="rejected" label="Rejected" />}
                            <Button size="sm" variant="ghost" onClick={() => setRegDay(rec)}>
                              Request regularization
                            </Button>
                          </>
                        )}
                      </span>
                    )}
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      </section>

      <BreakDialog
        open={breakOpen}
        onOpenChange={setBreakOpen}
        onConfirm={(category, note) => startBreak(employeeId, category, note)}
      />
      <ConfirmDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        title="End your day?"
        description={`You worked ${formatDuration(totals.workSeconds)} today. Signing in again later counts as overtime.`}
        confirmLabel="End my day"
        onConfirm={() => {
          endDay(employeeId)
          setEndOpen(false)
        }}
      />
      <ConfirmDialog
        open={overtimeOpen}
        onOpenChange={setOvertimeOpen}
        title="Start an overtime session?"
        description="You already ended your day. This session is flagged as overtime."
        confirmLabel="Start overtime"
        onConfirm={() => {
          startWork(employeeId, true)
          setOvertimeOpen(false)
        }}
      />
      <ReasonDialog
        open={regDay !== null}
        onOpenChange={(o) => !o && setRegDay(null)}
        title="Request regularization"
        description={regDay ? `${formatDate(regDay.date)}, late by ${regDay.late_minutes} minutes. Your team lead will review it.` : undefined}
        label="Reason"
        confirmLabel="Send request"
        onConfirm={(reason) => {
          if (regDay && !requestRegularization(regDay.id, reason)) toast.error('Could not send the request.')
        }}
      />
    </>
  )
}

function SegmentsTable({ segs, now }: { segs: TimeSegment[]; now: number }) {
  return (
    <Table>
      <Thead>
        <Tr className="hover:bg-transparent">
          <Th>Type</Th>
          <Th>Category</Th>
          <Th numeric>From</Th>
          <Th numeric>To</Th>
          <Th numeric>Duration</Th>
          <Th>Note</Th>
        </Tr>
      </Thead>
      <Tbody>
        {segs.map((s) => {
          const end = s.ended_at ? new Date(s.ended_at).getTime() : now
          return (
            <Tr key={s.id}>
              <Td>{s.type === 'work' ? 'Work' : 'Break'}</Td>
              <Td className="text-fg-muted">
                {s.type === 'break' ? breakCategoryLabels[s.break_category ?? 'short'] : '-'}
              </Td>
              <Td numeric>{formatTime(s.started_at)}</Td>
              <Td numeric>{s.ended_at ? formatTime(s.ended_at) : 'Running'}</Td>
              <Td numeric>{formatDuration((end - new Date(s.started_at).getTime()) / 1000)}</Td>
              <Td className="text-fg-muted">{s.note ?? ''}</Td>
            </Tr>
          )
        })}
      </Tbody>
    </Table>
  )
}
