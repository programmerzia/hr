import { formatDate, formatTime } from '../../lib/format'
import type { LeaveTrailEvent } from '../../types'

/** Compact "who did what, when" list for one leave request. */
export function LeaveTrail({ events }: { events: LeaveTrailEvent[] | undefined }) {
  if (!events || events.length === 0) return <p className="text-sm text-fg-muted">No activity recorded.</p>
  return (
    <ol className="flex flex-col gap-1.5 text-sm">
      {events.map((e, i) => (
        <li key={`${e.kind}-${i}`}>
          <span className={e.kind === 'rejected' ? 'font-medium text-danger' : 'font-medium'}>{e.text}</span>
          {e.by && <span className="text-fg-muted"> by {e.by}</span>}
          {e.at && (
            <span className="num text-fg-muted">
              {' · '}
              {formatDate(e.at)} {formatTime(e.at)}
            </span>
          )}
          {e.note && <span className="block text-fg-muted">{e.note}</span>}
        </li>
      ))}
    </ol>
  )
}
