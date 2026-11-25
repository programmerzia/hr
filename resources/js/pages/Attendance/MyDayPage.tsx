import { format, parseISO } from 'date-fns'
import { router } from '@inertiajs/react'
import { Bars } from '../../components/charts/Bars'
import { ChevronDown, Coffee, LogOut, Play } from 'lucide-react'
import { useState } from 'react'
import { BreakDialog } from '../../components/shared/BreakDialog'
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
  Field,
  Select,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui'
import { useShared } from '../../inertia/props'
import { formatClock, formatDate, formatDuration, formatTime } from '../../lib/format'
import { breakCategoryLabels } from '../../lib/status'
import type {
  AttendanceDay,
  AttendancePolicy,
  RegularizationRequest,
  TaskTimeEntry,
  TimeSegment,
} from '../../types'
import {
  EMPTY_TOTALS,
  dayGrade,
  isRunning,
  liveTotals,
  canRegularise,
  regularizableKinds,
  regularizationKindLabels,
  useServerNow,
  type DayTotals,
} from './lib'
import { GradeChip } from './GradeChip'
import { ReasonDialog } from './RegularizeDialog'
import { formatHours } from './useAttendanceSeries'

const NO_TASK = 'none'
const keep = { preserveScroll: true } as const

interface WeekRow {
  date: string
  day: AttendanceDay | null
  totals: DayTotals
  off: 'Weekend' | 'Holiday' | null
  regularization: 'pending' | 'rejected' | null
  last_note: string | null
}

interface MyDayProps {
  server_time: string
  day: AttendanceDay | null
  segments: TimeSegment[]
  totals: DayTotals
  task_entries: TaskTimeEntry[]
  week: WeekRow[]
  week_target_hours: number
  shift: { start: string; end: string }
  tasks: { id: string; key: string; title: string }[]
  current_task_id: string | null
  policy: AttendancePolicy
  regularizations: RegularizationRequest[]
  late_rule: { enabled: boolean; lates_per_penalty: number; count_this_month: number }
  recent_days: { day: AttendanceDay; regularization: 'pending' | 'rejected' | null; last_note: string | null }[]
  leave_today: { type: string; starts_on: string; ends_on: string } | null
}

type RegKind = 'late' | 'early' | 'absent' | 'auto_closed'

export default function MyDayPage() {
  const p = useShared<MyDayProps>()
  const now = useServerNow(p.server_time)
  const [breakOpen, setBreakOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [overtimeOpen, setOvertimeOpen] = useState(false)
  const [leaveAsk, setLeaveAsk] = useState<string | null>(null)
  const [regDay, setRegDay] = useState<AttendanceDay | null>(null)
  const [regKind, setRegKind] = useState<RegKind>('late')
  const [stripOpen, setStripOpen] = useState(false)
  const [intervalsOpen, setIntervalsOpen] = useState(() => {
    try {
      return localStorage.getItem('hr.myday.intervals') === '1'
    } catch {
      return false
    }
  })
  const toggleIntervals = () => {
    const next = !intervalsOpen
    setIntervalsOpen(next)
    try {
      localStorage.setItem('hr.myday.intervals', next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }
  const openReg = (d: AttendanceDay) => {
    setRegKind(regularizableKinds(d)[0] ?? 'late')
    setRegDay(d)
  }

  const day = p.day
  const status = day?.status ?? 'not_started'
  const segs = p.segments
  const openSeg = segs.find((s) => s.ended_at === null)
  const totals = liveTotals(p.totals ?? EMPTY_TOTALS, openSeg, p.server_time, now)
  const policy = p.policy
  const target = policy.standard_minutes * 60
  const today = format(new Date(now), 'yyyy-MM-dd')

  const shiftStart = new Date(p.shift.start)
  const shiftEnd = new Date(p.shift.end)
  const firstIn = day?.first_in_at ? new Date(day.first_in_at) : null
  const floorHour = (d: Date) => new Date(new Date(d).setMinutes(0, 0, 0))
  const rangeStart = floorHour(firstIn && firstIn < shiftStart ? firstIn : shiftStart)
  const rangeEnd = new Date(Math.max(shiftEnd.getTime(), floorHour(new Date(now)).getTime() + 3_600_000))
  const earlyCutoff = shiftEnd.getTime() - policy.early_leave_grace_minutes * 60_000
  const wouldLeaveEarly = (status === 'working' || status === 'on_break') && now < earlyCutoff
  const grade = status === 'ended' || (day && day.absence_kind !== 'none') ? dayGrade(day) : null
  const lr = p.late_rule
  const lateLeft = lr.enabled && lr.lates_per_penalty > 0 ? lr.count_this_month % lr.lates_per_penalty : 0
  const pct = Math.min(100, Math.round((totals.work_seconds / target) * 100))

  const weeklyData = p.week.map((w) => {
    const live = w.date === today && day?.id === w.day?.id ? liveTotals(w.totals, openSeg, p.server_time, now) : w.totals
    return { label: format(parseISO(w.date), 'EEE'), values: [live.work_seconds / 3600], active: w.date === today ? (true as const) : undefined }
  })
  const weekSeconds = Math.round(weeklyData.reduce((a, d) => a + (d.values[0] ?? 0) * 3600, 0))
  const weekRows = p.week.filter((w) => w.date <= today).reverse()
  const workdays = p.week.filter((w) => !w.off).length
  const workedDays = weeklyData.filter((d) => (d.values[0] ?? 0) > 0).length

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

  const taskOptions = [{ value: NO_TASK, label: 'No task' }, ...p.tasks.map((t) => ({ value: t.id, label: `${t.key}  ${t.title}` }))]
  const selectedTask = p.current_task_id && p.tasks.some((t) => t.id === p.current_task_id) ? p.current_task_id : null
  const taskSeconds = (taskId: string) =>
    p.task_entries
      .filter((e) => e.task_id === taskId)
      .reduce(
        (sum, e) => sum + (e.ended_at ? e.seconds : Math.max(0, (now - new Date(e.started_at).getTime()) / 1000)),
        0,
      )

  const startOrResume = (confirm = false, confirmLeave = false) => {
    router.post(route('attendance.resume'), { ...(confirm ? { confirm_overtime: true } : {}), ...(confirmLeave ? { confirm_leave: true } : {}) }, {
      ...keep,
      onError: (errors) => {
        if (errors.needs_overtime_confirm) setOvertimeOpen(true)
        if (errors.needs_leave_confirm) setLeaveAsk(errors.needs_leave_confirm)
      },
    })
  }

  const regs = p.regularizations
  const noRegs = (dayId: string) => regs.filter((r) => r.attendance_day_id === dayId)

  return (
    <>
      <PageHeader title="My day" description={formatDate(new Date(now))} />

      {p.leave_today && status !== 'working' && status !== 'on_break' && (
        <p role="status" className="mb-4 rounded border border-border bg-surface-2 px-3 py-2 text-sm">
          You're on approved {p.leave_today.type.toLowerCase()} today
          {p.leave_today.starts_on === p.leave_today.ends_on
            ? '.'
            : ` (${formatDate(new Date(`${p.leave_today.starts_on}T00:00`))} to ${formatDate(new Date(`${p.leave_today.ends_on}T00:00`))}).`}{' '}
          Nothing is tracked. If you start work, your leave ends from today and those days go back to your balance.
        </p>
      )}

      {p.recent_days.length > 0 && (
        <AttentionStrip
          days={p.recent_days}
          open={stripOpen}
          onToggle={() => setStripOpen((o) => !o)}
          onRegularise={openReg}
        />
      )}

      <Card>
        <CardBody className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={status} />
              {day && day.late_minutes > 0 && <StatusBadge status="late" label={`Late ${day.late_minutes}m`} />}
              {day && !isRunning(day) && day.early_minutes > 0 && <Badge variant="warning">Left early {day.early_minutes}m</Badge>}
              {grade && <Badge variant={grade.variant}>{grade.label}</Badge>}
              {!isRunning(day) && segs.some((s) => s.note === 'Overtime session') && <Badge variant="info">Overtime</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {status === 'working' && (
                <Button icon={<Coffee size={16} />} onClick={() => setBreakOpen(true)}>
                  Take a break
                </Button>
              )}
              {status === 'on_break' && (
                <Button variant="primary" icon={<Play size={16} />} onClick={() => startOrResume()}>
                  Resume
                </Button>
              )}
              {(status === 'not_started' || status === 'on_leave' || status === 'absent' || status === 'holiday') && (
                <Button variant="primary" icon={<Play size={16} />} onClick={() => startOrResume()}>
                  Start work
                </Button>
              )}
              {status === 'ended' && (
                <Button icon={<Play size={16} />} onClick={() => startOrResume()}>
                  {totals.work_seconds < target ? 'Continue my day' : 'Start overtime'}
                </Button>
              )}
              {(status === 'working' || status === 'on_break') && (
                <Button icon={<LogOut size={16} />} onClick={() => setEndOpen(true)}>
                  End my day
                </Button>
              )}
            </div>
          </div>
          {lr.enabled && lr.count_this_month > 0 && (
            <p className="text-xs text-fg-muted">
              {lateLeft === 0
                ? `${lr.count_this_month} lates this month. ${lr.lates_per_penalty} lates cost half a day.`
                : `${lateLeft} of ${lr.lates_per_penalty} lates this month before a half-day deduction.`}
            </p>
          )}

          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="num text-[40px] font-semibold leading-[48px]">{formatClock(totals.work_seconds)}</span>
            <p className="text-[13px] text-fg-muted">
              {sinceText}
              {sinceText && ' · '}
              Break <DurationText seconds={totals.break_seconds} />
              {totals.offline_seconds >= 60 && (
                <>
                  {' · '}Offline today <DurationText seconds={totals.offline_seconds} />
                </>
              )}
              {totals.idle_seconds >= 60 && (
                <>
                  {' · '}Idle <DurationText seconds={totals.idle_seconds} />
                </>
              )}
            </p>
          </div>

          <div>
            <div
              role="progressbar"
              aria-label="Daily target"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              className="h-1.5 overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className={`h-full rounded-full ${pct >= 100 ? 'bg-success' : 'bg-accent'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="num mt-1 text-xs text-fg-muted">
              {formatDuration(totals.work_seconds)} of {formatDuration(target)} · {pct}%
            </p>
          </div>

          <TimelineBar
            segments={segs}
            rangeStart={rangeStart.toISOString()}
            rangeEnd={rangeEnd.toISOString()}
            now={now}
            targetAt={shiftEnd.toISOString()}
          />

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <span className="text-sm font-medium">Current task</span>
            <Select
              aria-label="Current task"
              className="w-full sm:w-80"
              value={selectedTask ?? NO_TASK}
              onValueChange={(v) => router.post(route('attendance.current-task'), { task_id: v === NO_TASK ? null : v }, keep)}
              options={taskOptions}
              disabled={taskOptions.length === 1}
              placeholder="No task"
            />
            <span className="text-[13px] text-fg-muted">
              {taskOptions.length === 1
                ? 'No tasks are assigned to you.'
                : selectedTask
                  ? status === 'working'
                    ? `Tracked today: ${formatDuration(taskSeconds(selectedTask))}`
                    : 'Time is tracked while you are working.'
                  : 'Time without a task is unallocated.'}
            </span>
          </div>
        </CardBody>
      </Card>

      <section className="mt-4 min-w-0" aria-label="Today's intervals">
        <button
          type="button"
          aria-expanded={intervalsOpen}
          aria-controls="intervals-panel"
          onClick={toggleIntervals}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-left text-sm hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="num min-w-0 truncate">
            <span className="font-medium">Today's intervals</span>
            <span className="text-fg-muted">
              {' · '}Work {formatDuration(totals.work_seconds)} · Break {formatDuration(totals.break_seconds)}
              {totals.offline_seconds >= 60 && <> · Offline {formatDuration(totals.offline_seconds)}</>}
              {totals.idle_seconds >= 60 && <> · Idle {formatDuration(totals.idle_seconds)}</>}
              {' · '}
              {segs.length} {segs.length === 1 ? 'interval' : 'intervals'}
            </span>
          </span>
          <ChevronDown size={16} className={`shrink-0 text-fg-subtle transition-transform ${intervalsOpen ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        <div id="intervals-panel" hidden={!intervalsOpen} className="mt-2">
          {intervalsOpen &&
            (segs.length === 0 ? (
              <EmptyTable title="Nothing recorded yet" description="Segments appear here once you start work." />
            ) : (
              <SegmentsTable segs={[...segs].reverse()} now={now} />
            ))}
          {intervalsOpen && totals.lunch_over_cap_minutes > 0 && (
            <p className="mt-2 text-sm text-warning">
              Lunch is {totals.lunch_over_cap_minutes}m over the {policy.lunch_cap_minutes}m cap.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 min-w-0" aria-labelledby="week-h">
        <h2 id="week-h" className="mb-2 text-[15px] font-semibold">
          This week
        </h2>
        <Card className="mb-3">
          <CardBody className="grid gap-4 md:grid-cols-[1fr_16rem] md:items-center">
            <Bars
              data-testid="week-bars"
              data={weeklyData}
              series={[{ name: 'Worked' }]}
              target={{ value: p.week_target_hours, label: `${p.week_target_hours}h target` }}
              height={128}
              format={formatHours}
              aria-label={`Hours worked each day this week, ${formatDuration(weekSeconds)} in total`}
            />
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-1">
              <div>
                <dt className="text-[13px] text-fg-muted">Worked this week</dt>
                <dd className="num text-2xl font-semibold">{formatDuration(weekSeconds)}</dd>
                <dd className="text-xs text-fg-subtle">of {formatDuration(workdays * target)} expected</dd>
              </div>
              <div>
                <dt className="text-[13px] text-fg-muted">Average per worked day</dt>
                <dd className="num text-lg font-medium">
                  {formatDuration(workedDays ? weekSeconds / workedDays : 0)}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
        <Table>
          <Thead>
            <Tr className="hover:bg-transparent">
              <Th>Day</Th>
              <Th numeric>In</Th>
              <Th numeric>Out</Th>
              <Th numeric>Work</Th>
              <Th numeric>Break</Th>
              <Th numeric>Offline</Th>
              <Th numeric>Late</Th>
              <Th>Status</Th>
              <Th>Grade</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {weekRows.map((w) => {
              const rec = w.day
              const t = rec && w.date === today ? liveTotals(w.totals, openSeg, p.server_time, now) : w.totals
              const key = w.date
              const pending = rec && noRegs(rec.id).some((r) => r.status === 'pending')
              const rejected = rec && noRegs(rec.id).some((r) => r.status === 'rejected')
              return (
                <Tr key={key} className={key === today ? 'bg-accent-soft font-semibold' : undefined}>
                  <Td className="whitespace-nowrap">{key === today ? 'Today' : format(parseISO(key), 'EEE d MMM')}</Td>
                  <Td numeric>{rec?.first_in_at ? formatTime(rec.first_in_at) : '-'}</Td>
                  <Td numeric>{rec?.last_out_at ? formatTime(rec.last_out_at) : '-'}</Td>
                  <Td numeric>{rec && rec.first_in_at ? formatDuration(t.work_seconds) : '-'}</Td>
                  <Td numeric>{rec && rec.first_in_at ? formatDuration(t.break_seconds) : '-'}</Td>
                  <Td numeric>{rec && rec.first_in_at && t.offline_seconds >= 60 ? formatDuration(t.offline_seconds) : '-'}</Td>
                  <Td numeric>{rec && rec.late_minutes > 0 ? `${rec.late_minutes}m` : '-'}</Td>
                  <Td>
                    {rec ? (
                      <StatusBadge status={rec.status} />
                    ) : w.off ? (
                      <StatusBadge status="holiday" label={w.off} />
                    ) : (
                      <span className="text-fg-subtle">-</span>
                    )}
                  </Td>
                  <Td>
                    <GradeChip day={rec && key < today ? rec : null} />
                  </Td>
                  <Td className="text-right">
                    {rec && (rec.is_regularized || (canRegularise(rec, today) && regularizableKinds(rec).length > 0)) && (
                      <span className="inline-flex items-center gap-2">
                        {rec.is_regularized ? (
                          <Badge variant="success">Regularized</Badge>
                        ) : pending ? (
                          <StatusBadge status="pending" label="Regularization pending" />
                        ) : (
                          <>
                            {rejected && <StatusBadge status="rejected" label="Rejected" />}
                            {rejected && w.last_note && <span className="max-w-48 truncate text-xs text-fg-muted" title={w.last_note}>{w.last_note}</span>}
                            <Button size="sm" variant="ghost" onClick={() => openReg(rec)}>
                              Regularise
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
        onConfirm={(category, note) => router.post(route('attendance.break'), { category, note: note || null }, keep)}
      />
      <ConfirmDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        title="End your day?"
        description={`You worked ${formatDuration(totals.work_seconds)} today.${wouldLeaveEarly ? ` Ending before ${formatTime(new Date(earlyCutoff).toISOString())} counts as an early leave.` : ''} Starting again later continues the day until you reach your daily hours; after that it counts as overtime.`}
        confirmLabel="End my day"
        onConfirm={() => {
          router.post(route('attendance.end-day'), {}, keep)
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
          startOrResume(true)
          setOvertimeOpen(false)
        }}
      />
      <ConfirmDialog
        open={leaveAsk !== null}
        onOpenChange={(o) => !o && setLeaveAsk(null)}
        title="End your leave and start work?"
        description={leaveAsk ?? ''}
        confirmLabel="Start work"
        onConfirm={() => {
          startOrResume(false, true)
          setLeaveAsk(null)
        }}
      />
      <ReasonDialog
        open={regDay !== null}
        onOpenChange={(o) => !o && setRegDay(null)}
        title="Request regularization"
        description={regDay ? `${formatDate(regDay.date)}. Your team lead will review it.` : undefined}
        label="Reason"
        confirmLabel="Send request"
        onConfirm={(reason) => {
          if (regDay) router.post(route('attendance.regularizations.store'), { attendance_day_id: regDay.id, reason, kind: regKind }, keep)
        }}
      >
        {regDay && (
          <Field label="What to regularise">
            <Select
              value={regKind}
              onValueChange={(v) => setRegKind(v as RegKind)}
              options={regularizableKinds(regDay).map((k) => ({
                value: k,
                label:
                  k === 'late'
                    ? `${regularizationKindLabels[k]} (${regDay.late_minutes}m)`
                    : k === 'early'
                      ? `${regularizationKindLabels[k]} (${regDay.early_minutes}m)`
                      : (regularizationKindLabels[k] ?? k),
              }))}
            />
          </Field>
        )}
      </ReasonDialog>
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
              <Td>{s.type === 'work' ? 'Work' : s.break_category === 'offline' ? 'Offline' : 'Break'}</Td>
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

function AttentionStrip({
  days,
  open,
  onToggle,
  onRegularise,
}: {
  days: MyDayProps['recent_days']
  open: boolean
  onToggle: () => void
  onRegularise: (d: AttendanceDay) => void
}) {
  const shown = open ? days : days.slice(0, 3)
  const more = days.length - 3
  return (
    <div role="region" aria-label="Days needing attention" className="mb-4 rounded-lg border border-warning/30 bg-warning-soft px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-warning">
          {days.length} {days.length === 1 ? 'day needs' : 'days need'} attention
        </span>
        {more > 0 && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="rounded text-xs font-medium text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {open ? 'Show less' : `+${more} more`}
          </button>
        )}
      </div>
      <ul className="mt-1 flex flex-col gap-0.5">
        {shown.map(({ day: d, regularization, last_note }) => {
          const issue = regularizableKinds(d)
            .map((k) =>
              k === 'late'
                ? `Late ${d.late_minutes}m`
                : k === 'early'
                  ? `Left early ${d.early_minutes}m`
                  : (regularizationKindLabels[k] ?? k),
            )
            .join(', ')
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-x-2 text-[13px]">
              <span className="num whitespace-nowrap">
                {format(parseISO(d.date), 'EEE d MMM')} · {issue}
              </span>
              {regularization === 'pending' ? (
                <StatusBadge status="pending" label="Regularization pending" />
              ) : (
                <>
                  {regularization === 'rejected' && (
                    <span title={last_note ?? undefined}>
                      <StatusBadge status="rejected" label="Rejected" />
                    </span>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onRegularise(d)}>
                    Regularise
                  </Button>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
