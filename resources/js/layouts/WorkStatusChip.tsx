import { router } from '@inertiajs/react'
import { Coffee, Play, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BreakDialog } from '../components/shared/BreakDialog'
import { StatusDot } from '../components/shared/StatusBadge'
import { useWorkSeconds } from '../inertia/clock'
import { useShared } from '../inertia/props'
import { cn } from '../lib/cn'
import { formatClock } from '../lib/format'
import { statusMeta } from '../lib/status'

const keep = { preserveScroll: true, preserveState: true } as const

/** Browser online/offline, for display only. The server records offline gaps from missed heartbeats. */
function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

/** Today's status and work time, with the one action that matters right now. Visible on every page. */
export function WorkStatusChip() {
  const { attendance } = useShared()
  const online = useOnline()
  const [breakOpen, setBreakOpen] = useState(false)
  const seconds = useWorkSeconds(attendance)

  const status = attendance?.day?.status ?? 'not_started'
  const meta = statusMeta(status)

  const act =
    status === 'working'
      ? { label: 'Take a break', icon: <Coffee size={14} />, run: () => setBreakOpen(true) }
      : status === 'on_break' || status === 'not_started'
        ? {
            label: status === 'on_break' ? 'Resume' : 'Start work',
            icon: <Play size={14} />,
            run: () => router.post(route('attendance.resume'), {}, keep),
          }
        : { label: 'Start overtime', icon: <Play size={14} />, run: () => router.visit('/my-day') }

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
          onClick={() => router.visit('/my-day')}
          aria-label={`Work status: ${meta.label}${online ? '' : ', offline'}. Open my day`}
          className="flex items-center gap-2 px-2.5 text-sm transition-colors duration-150 hover:bg-fg/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
        >
          {online ? (
            <StatusDot variant={meta.variant} pulse={status === 'working'} />
          ) : (
            <WifiOff size={14} className="text-fg-muted" aria-hidden />
          )}
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
        onConfirm={(category, note) =>
          router.post(route('attendance.break'), { category, note: note || null }, keep)
        }
      />
    </>
  )
}
