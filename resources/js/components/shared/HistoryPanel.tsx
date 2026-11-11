import { relativeTime, formatDate, formatTime } from '../../lib/format'
import { Card, CardBody, CardHeader } from '../ui'

export interface HistoryEntry {
  at: string
  actor: string
  text: string
}

export function HistoryPanel({ entries, title = 'History', now }: { entries: HistoryEntry[]; title?: string; now?: Date }) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        {entries.length === 0 ? (
          <p className="text-sm text-fg-muted">No activity yet.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {entries.map((e, i) => (
              <li key={`${e.at}-${i}`} className="text-sm">
                <p>
                  <span className="font-medium">{e.actor}</span> <span className="text-fg-muted">{e.text}</span>
                </p>
                <p className="text-xs text-fg-subtle" title={`${formatDate(e.at)} ${formatTime(e.at)}`}>
                  {relativeTime(e.at, now)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  )
}
