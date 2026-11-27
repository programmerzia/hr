import { router } from '@inertiajs/react'
import { Coffee, Play, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BreakDialog } from '../components/shared/BreakDialog'
import { StatusDot } from '../components/shared/StatusBadge'
import { Button, Dialog } from '../components/ui'
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

/** Time of the last keyboard or pointer input in this tab, refreshed at most every few seconds. */
function useLastInput(): number {
  const [at, setAt] = useState(0)
  useEffect(() => {
    let last = 0
    const on = () => {
      const t = Date.now()
      if (t - last > 5000) {
        last = t
        setAt(t)
      }
    }
    const events = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, on, { passive: true, capture: true }))
    return () => events.forEach((e) => window.removeEventListener(e, on, { capture: true }))
  }, [])
  return at
}

/** Breaks the person picks themselves; idle and offline breaks end on their own. */
const MANUAL_BREAKS = ['short', 'tea', 'lunch', 'official']
const START_PROMPT_KEY = 'hr.startPrompt.dismissed'

function readDismissed(): string | null {
  try {
    return localStorage.getItem(START_PROMPT_KEY)
  } catch {
    return null
  }
}

/**
 * Signed in through a remembered session, so nothing started the day: ask once, on the first input of the day
 * (not on page load, and never by clicking the chip itself). "Not now" stays quiet for the rest of the day.
 */
function useStartPrompt(due: boolean, today: string): [boolean, (open: boolean) => void, () => void] {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!due || readDismissed() === today) return
    const on = (e: Event) => {
      const target = e.target as Element | null
      if (target?.closest?.('[data-testid="work-chip"]')) return
      setOpen(true)
      stop()
    }
    const stop = () => {
      window.removeEventListener('pointerdown', on, { capture: true })
      window.removeEventListener('keydown', on, { capture: true })
    }
    window.addEventListener('pointerdown', on, { capture: true })
    window.addEventListener('keydown', on, { capture: true })
    return stop
  }, [due, today])
  const dismiss = () => {
    try {
      localStorage.setItem(START_PROMPT_KEY, today)
    } catch {
      // storage blocked: the prompt may ask again after a reload
    }
    setOpen(false)
  }
  // Started meanwhile (chip, My day, another tab): the question no longer applies.
  return [open && due, setOpen, dismiss]
}

/** Today's status and work time, with the one action that matters right now. Visible on every page. */
export function WorkStatusChip() {
  const { attendance } = useShared()
  const online = useOnline()
  const [breakOpen, setBreakOpen] = useState(false)
  const seconds = useWorkSeconds(attendance)
  const lastInput = useLastInput()

  const status = attendance?.day?.status ?? 'not_started'
  const meta = statusMeta(status)
  const today = attendance?.server_time?.slice(0, 10) ?? ''
  const [askStart, setAskStart, dismissStart] = useStartPrompt(Boolean(attendance?.start_prompt), today)

  // A manual break past its usual length while the person is clearly here (input since then): ask, never convert.
  const open = attendance?.open_segment
  const breakCap = open?.break_category === 'lunch' ? (attendance?.policy.lunch_cap_minutes ?? 60) : 60
  const overrunAt = open && !open.ended_at && open.type === 'break' && MANUAL_BREAKS.includes(open.break_category ?? '')
    ? new Date(open.started_at).getTime() + breakCap * 60_000
    : null
  const stillOnBreak = status === 'on_break' && overrunAt !== null && lastInput > overrunAt

  const resume = () =>
    router.post(route('attendance.resume'), {}, {
      ...keep,
      // On approved leave: the confirmation lives on My day.
      onError: (errors) => {
        if (errors.needs_leave_confirm) router.visit('/my-day')
      },
    })

  const act =
    status === 'working'
      ? { label: 'Take a break', icon: <Coffee size={14} />, run: () => setBreakOpen(true) }
      : status === 'on_break' || status === 'not_started'
        ? {
            label: stillOnBreak ? 'Resume work' : status === 'on_break' ? 'Resume' : 'Start work',
            icon: <Play size={14} />,
            run: resume,
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
          aria-label={`Work status: ${stillOnBreak ? 'still on break?' : meta.label}${online ? '' : ', offline'}. Open my day`}
          className="flex items-center gap-2 px-2.5 text-sm transition-colors duration-150 hover:bg-fg/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {online ? (
            <StatusDot variant={meta.variant} pulse={status === 'working'} />
          ) : (
            <WifiOff size={14} className="text-fg-muted" aria-hidden />
          )}
          <span className={cn('hidden font-medium sm:inline', status === 'not_started' && 'text-fg-muted')}>
            {stillOnBreak ? 'Still on break?' : meta.label}
          </span>
          <span className="num  text-fg">{formatClock(seconds)}</span>
        </button>
        <button
          type="button"
          onClick={act.run}
          className="flex items-center gap-1.5 border-l border-fg/10 px-2.5 text-sm font-medium text-fg transition-colors duration-150 hover:bg-fg/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {act.icon}
          <span className="hidden md:inline">{act.label}</span>
          <span className="sr-only md:hidden">{act.label}</span>
        </button>
      </div>
      <Dialog
        open={askStart}
        onOpenChange={(o) => (o ? setAskStart(true) : dismissStart())}
        title="Start your day?"
        description="Your work time is not running yet. Start it now so today is recorded."
        footer={
          <>
            <Button variant="ghost" onClick={dismissStart}>
              Not now
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setAskStart(false)
                resume()
              }}
            >
              Start work
            </Button>
          </>
        }
      />
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
