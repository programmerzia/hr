import { Coffee, Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { BreakDialog } from '../components/shared/BreakDialog'
import { StatusDot } from '../components/shared/StatusBadge'
import { cn } from '../lib/cn'
import { formatClock } from '../lib/format'
import { statusMeta } from '../lib/status'
import { computeTotals, todayKey, useAttendance } from '../mock/stores/attendance'
import { useAuthed } from '../mock/session'

/** Today's status and work time, with the one action that matters right now. Visible on every page. */
export function WorkStatusChip() {
  const { employee } = useAuthed()
  const navigate = useNavigate()
  const now = useAttendance((s) => s.now)
  const days = useAttendance((s) => s.days)
  const segments = useAttendance((s) => s.segments)
  const startWork = useAttendance((s) => s.startWork)
  const startBreak = useAttendance((s) => s.startBreak)
  const [breakOpen, setBreakOpen] = useState(false)

  const today = todayKey()
  const day = useMemo(
    () => days.find((d) => d.employee_id === employee.id && d.date === today),
    [days, employee.id, today],
  )
  const status = day?.status ?? 'not_started'
  const seconds = useMemo(
    () => (day ? computeTotals(segments.filter((s) => s.attendance_day_id === day.id), now).workSeconds : 0),
    [day, segments, now],
  )
  const meta = statusMeta(status)

  const act =
    status === 'working'
      ? { label: 'Take a break', icon: <Coffee size={14} />, run: () => setBreakOpen(true) }
      : status === 'on_break'
        ? { label: 'Resume', icon: <Play size={14} />, run: () => void startWork(employee.id) }
        : status === 'ended'
          ? { label: 'Start overtime', icon: <Play size={14} />, run: () => navigate('/my-day') }
          : {
              label: 'Start work',
              icon: <Play size={14} />,
              run: () => {
                if (startWork(employee.id) === 'needs_overtime_confirm') navigate('/my-day')
              },
            }

  return (
    <>
      <div
        data-testid="work-chip"
        className={cn(
          'flex h-8 items-stretch overflow-hidden rounded-md border shadow-xs transition-colors duration-150',
          status === 'working' && 'border-success/30 bg-success-soft',
          status === 'on_break' && 'border-warning/30 bg-warning-soft',
          status !== 'working' && status !== 'on_break' && 'border-border-strong bg-surface-2',
        )}
      >
        <button
          type="button"
          onClick={() => navigate('/my-day')}
          aria-label={`Work status: ${meta.label}. Open my day`}
          className="flex items-center gap-2 px-2.5 text-sm transition-colors duration-150 hover:bg-fg/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
        >
          <StatusDot variant={meta.variant} pulse={status === 'working'} />
          <span className={cn('hidden font-medium sm:inline', status === 'not_started' && 'text-fg-muted')}>
            {meta.label}
          </span>
          <span className="font-mono tabular-nums text-fg">{formatClock(seconds)}</span>
        </button>
        <button
          type="button"
          onClick={act.run}
          className="flex items-center gap-1.5 border-l border-fg/10 px-2.5 text-sm font-medium text-fg transition-colors duration-150 hover:bg-fg/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
        >
          {act.icon}
          <span className="hidden md:inline">{act.label}</span>
          <span className="sr-only md:hidden">{act.label}</span>
        </button>
      </div>
      <BreakDialog
        open={breakOpen}
        onOpenChange={setBreakOpen}
        onConfirm={(category, note) => startBreak(employee.id, category, note)}
      />
    </>
  )
}
