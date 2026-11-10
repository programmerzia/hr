import { formatDuration, formatTime } from '../../lib/format'
import { breakCategoryLabels } from '../../lib/status'
import { cn } from '../../lib/cn'
import { Tooltip } from '../ui/Tooltip'
import type { BreakCategory, SegmentType } from '../../types'

export interface TimelineSegment {
  type: SegmentType
  break_category?: BreakCategory | null
  started_at: string
  ended_at: string | null
}

interface TimelineBarProps {
  segments: TimelineSegment[]
  rangeStart: string
  rangeEnd: string
  /** Current time in ms; draws the "now" marker and closes the open segment. */
  now?: number
  /** Shift end; draws the target marker. */
  targetAt?: string
  className?: string
}

const hatchIdle =
  'repeating-linear-gradient(135deg, rgb(var(--warning) / 0.7) 0 2px, rgb(var(--warning-soft)) 2px 5px)'
const hatchOffline =
  'repeating-linear-gradient(135deg, rgb(var(--fg-subtle) / 0.7) 0 2px, rgb(var(--surface-2)) 2px 5px)'
const breakFill = 'rgb(var(--warning) / 0.45)'

type Kind = 'work' | 'break' | 'idle' | 'offline'

function segmentKind(s: TimelineSegment): Kind {
  if (s.type === 'work') return 'work'
  if (s.break_category === 'idle') return 'idle'
  if (s.break_category === 'offline') return 'offline'
  return 'break'
}

function segmentStyle(kind: Kind, left: number, width: number) {
  const base = { left: `${left}%`, width: `${width}%` }
  if (kind === 'work') return { ...base, backgroundColor: 'rgb(var(--accent))' }
  if (kind === 'idle') return { ...base, backgroundImage: hatchIdle }
  if (kind === 'offline') return { ...base, backgroundImage: hatchOffline }
  return { ...base, backgroundColor: breakFill }
}

/** Even hours (10:00, 12:00, ...) inside the range. */
function hourTicks(start: number, end: number): number[] {
  const first = new Date(start)
  first.setMinutes(0, 0, 0)
  const ticks: number[] = []
  for (let t = first.getTime(); t <= end; t += 3_600_000) {
    if (t >= start && new Date(t).getHours() % 2 === 0) ticks.push(t)
  }
  return ticks
}

export function TimelineBar({ segments, rangeStart, rangeEnd, now, targetAt, className }: TimelineBarProps) {
  const start = new Date(rangeStart).getTime()
  const end = new Date(rangeEnd).getTime()
  const span = Math.max(end - start, 1)
  const clock = now ?? end
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - start) / span) * 100))
  const ticks = hourTicks(start, end)
  const target = targetAt ? pct(new Date(targetAt).getTime()) : null

  return (
    <div className={cn('w-full', className)}>
      <div className="relative pt-1">
        <div
          role="img"
          aria-label="Today's timeline"
          className="relative h-4 w-full overflow-hidden rounded-full bg-surface-2 shadow-[inset_0_0_0_1px_rgb(var(--border))]"
        >
          {segments.map((s, i) => {
            const segEnd = s.ended_at ? new Date(s.ended_at).getTime() : clock
            const a = pct(new Date(s.started_at).getTime())
            const b = pct(segEnd)
            if (b <= a) return null
            const secs = (segEnd - new Date(s.started_at).getTime()) / 1000
            const name = s.type === 'work' ? 'Work' : (breakCategoryLabels[s.break_category ?? 'short'] ?? 'Break')
            const kind = segmentKind(s)
            return (
              <Tooltip
                key={`${s.started_at}-${i}`}
                content={`${name} · ${formatTime(s.started_at)} to ${s.ended_at ? formatTime(s.ended_at) : 'now'} · ${formatDuration(secs)}`}
              >
                <div
                  data-segment={kind}
                  className="absolute inset-y-0 transition-[width] duration-1000 ease-linear"
                  style={segmentStyle(kind, a, b - a)}
                />
              </Tooltip>
            )
          })}
        </div>
        {target !== null && (
          <span
            className="absolute bottom-0 top-0 w-px border-l border-dashed border-fg-subtle"
            style={{ left: `${target}%` }}
            aria-hidden
          />
        )}
        {now !== undefined && now >= start && now <= end && (
          <span
            data-testid="timeline-now"
            className="absolute -bottom-0.5 -top-0 w-0.5 -translate-x-1/2 rounded-full bg-fg"
            style={{ left: `${pct(now)}%` }}
            aria-hidden
          />
        )}
      </div>
      <div className="relative mt-1 h-4 text-xs tabular-nums text-fg-subtle" aria-hidden>
        {ticks.map((t) => {
          const left = pct(t)
          return (
            <span
              key={t}
              className={cn(
                'absolute top-0',
                left < 3 ? 'translate-x-0' : left > 97 ? '-translate-x-full' : '-translate-x-1/2',
              )}
              style={{ left: `${left}%` }}
            >
              {formatTime(new Date(t))}
            </span>
          )
        })}
      </div>
      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
        <Legend label="Work" style={{ backgroundColor: 'rgb(var(--accent))' }} />
        <Legend label="Break" style={{ backgroundColor: breakFill }} />
        <Legend label="Idle" style={{ backgroundImage: hatchIdle }} />
        <Legend label="Offline" style={{ backgroundImage: hatchOffline }} />
      </ul>
    </div>
  )
}

function Legend({ label, style }: { label: string; style: React.CSSProperties }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-sm border border-border" style={style} aria-hidden />
      {label}
    </li>
  )
}
