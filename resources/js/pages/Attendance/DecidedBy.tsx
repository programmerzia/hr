import { formatDate, formatTime } from '../../lib/format'

/** "Decided by X · 21 Nov 14:03", read only; nothing while the request is pending. */
export function DecidedBy({ name, at }: { name: string | null; at: string | null }) {
  if (!name && !at) return null
  return (
    <p className="num text-xs text-fg-muted">
      Decided{name ? ` by ${name}` : ''}
      {at ? ` · ${formatDate(at)} ${formatTime(at)}` : ''}
    </p>
  )
}
