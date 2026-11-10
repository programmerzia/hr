import { formatDuration, formatTime } from '../../lib/format'
import { breakCategoryLabels } from '../../lib/status'
import { cn } from '../../lib/cn'
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
  className?: string
}

const hatch =
  'repeating-linear-gradient(135deg, rgb(var(--fg-subtle) / 0.55) 0 2px, rgb(var(--surface-2)) 2px 5px)'

function segmentStyle(s: TimelineSegment, left: number, width: number) {
  const base = { left: `${left}%`, width: `${width}%` }
  if (s.type === 'work') return { ...base, backgroundColor: 'rgb(var(--accent))' }
  if (s.break_category === 'idle') return { ...base, backgroundImage: hatch }
  return { ...base, backgroundColor: 'rgb(var(--warning) / 0.35)' }
}

export function TimelineBar({ segments, rangeStart, rangeEnd, className }: TimelineBarProps) {
  const start = new Date(rangeStart).getTime()
  const end = new Date(rangeEnd).getTime()
  const span = Math.max(end - start, 1)
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - start) / span) * 100))

  return (
    <div className={cn('w-full', className)}>
      <div
        role="img"
        aria-label="Today's timeline"
        className="relative h-6 w-full overflow-hidden rounded border border-border bg-surface-2"
      >
        {segments.map((s, i) => {
          const a = pct(new Date(s.started_at).getTime())
          const b = pct(s.ended_at ? new Date(s.ended_at).getTime() : end)
          if (b <= a) return null
          const secs = ((s.ended_at ? new Date(s.ended_at).getTime() : end) - new Date(s.started_at).getTime()) / 1000
          const name = s.type === 'work' ? 'Work' : (breakCategoryLabels[s.break_category ?? 'short'] ?? 'Break')
          return (
            <div
              key={`${s.started_at}-${i}`}
              className="absolute inset-y-0"
              style={segmentStyle(s, a, b - a)}
              title={`${name}, ${formatTime(s.started_at)} to ${s.ended_at ? formatTime(s.ended_at) : 'now'} (${formatDuration(secs)})`}
            />
          )
        })}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs text-fg-muted">
        <span className="tabular-nums">{formatTime(rangeStart)}</span>
        <ul className="flex items-center gap-3">
          <Legend label="Work" style={{ backgroundColor: 'rgb(var(--accent))' }} />
          <Legend label="Break" style={{ backgroundColor: 'rgb(var(--warning) / 0.35)' }} />
          <Legend label="Idle" style={{ backgroundImage: hatch }} />
        </ul>
        <span className="tabular-nums">{formatTime(rangeEnd)}</span>
      </div>
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
