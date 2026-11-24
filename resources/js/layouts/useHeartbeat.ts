import { router } from '@inertiajs/react'
import { useEffect } from 'react'

/** Input events that count as "someone is here". Idle means none of these for the policy's idle timeout. */
const ACTIVITY_EVENTS = ['keydown', 'pointerdown', 'wheel', 'scroll', 'touchstart'] as const

/** Why beats stopped, as this browser saw it. The server turns it into the offline break's note. */
type GapReason = 'no_internet' | 'unreachable' | 'asleep' | 'suspended' | 'closed'

const BEAT_MS = 60_000
const TICK_MS = 10_000
/** Timers in a background tab can run as rarely as once a minute; a longer silence means the page was not running. */
const JUMP_MS = 150_000
const STORE_KEY = 'hr.presence'

interface Stored {
  alive: number
  closedAt?: number
}

function readStore(): Stored | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}

function writeStore(v: Stored) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(v))
  } catch {
    // private mode or storage blocked: the server falls back to "No signal from the HR app"
  }
}

/**
 * POST /heartbeat every 60 s while the shell is mounted; refreshes only `attendance` and `badges`.
 * Beats keep going while the tab is in the background, so by default (presence) an open tab counts as working; the
 * server records offline after the policy's "offline after" minutes with no beat at all.
 *
 * When beats stop, this hook works out why and tells the server on the first beat back (gap_reason + gap_since):
 * - no_internet: the browser went offline while the page was running (exact time of the drop)
 * - unreachable: the device was online but heartbeats failed (network problem or the server was down)
 * - asleep: the page's own clock jumped, i.e. the device slept or was locked and suspended
 * - suspended: the browser froze or discarded the tab (Memory Saver / sleeping tabs)
 * - closed: the HR tab was closed and opened again later
 * Each beat also carries `last_activity_at` (last input), used only when HR turns on strict idle.
 */
export function useHeartbeat() {
  useEffect(() => {
    let lastActivity = Date.now()
    let lastMove = 0
    const touch = () => {
      lastActivity = Date.now()
    }
    const onMove = () => {
      const t = Date.now()
      if (t - lastMove > 1000) {
        lastMove = t
        lastActivity = t
      }
    }

    // The first cause seen wins: it is the one that started the silence.
    let gap: { reason: GapReason; since: number } | null = null
    const noteGap = (reason: GapReason, since: number) => {
      gap ??= { reason, since }
    }

    // Opened again after the tab was closed, or reloaded after the browser discarded it.
    const stored = readStore()
    if (stored) {
      if ((document as Document & { wasDiscarded?: boolean }).wasDiscarded) noteGap('suspended', stored.alive)
      else if (stored.closedAt) noteGap('closed', stored.closedAt)
    }
    let lastTick = Date.now()
    writeStore({ alive: lastTick })

    let lastBeat = 0
    const beat = () => {
      if (!navigator.onLine) {
        noteGap('no_internet', Date.now())
        return
      }
      const attempt = Date.now()
      lastBeat = attempt
      const sent = gap
      let reached = false
      router.post(
        route('heartbeat'),
        {
          last_activity_at: new Date(lastActivity).toISOString(),
          gap_reason: sent?.reason ?? null,
          gap_since: sent ? new Date(sent.since).toISOString() : null,
        },
        {
          preserveState: true,
          preserveScroll: true,
          only: ['attendance', 'badges'],
          async: true,
          onSuccess: () => {
            reached = true
            if (gap === sent) gap = null
          },
          onError: () => {
            reached = true
          },
          onFinish: () => {
            if (!reached) noteGap(navigator.onLine ? 'unreachable' : 'no_internet', attempt)
          },
        },
      )
    }
    // Back after a while (woke, reconnected, tab refocused): beat now; skip if one just went out.
    const beatSoon = () => {
      if (Date.now() - lastBeat > 15_000) beat()
    }

    let frozenAt: number | null = null
    const tick = () => {
      const t = Date.now()
      if (t - lastTick > JUMP_MS) {
        noteGap(frozenAt ? 'suspended' : 'asleep', frozenAt ?? lastTick)
        frozenAt = null
        lastTick = t
        writeStore({ alive: t })
        beat()
        return
      }
      lastTick = t
      writeStore({ alive: t })
    }
    const onFreeze = () => {
      frozenAt = Date.now()
    }
    const onResume = () => {
      if (frozenAt) noteGap('suspended', frozenAt)
      frozenAt = null
      lastTick = Date.now()
      beatSoon()
    }
    const onOffline = () => {
      // Right after waking up browsers often report offline for a moment; the clock jump tells that case apart.
      if (Date.now() - lastTick < 30_000) noteGap('no_internet', Date.now())
    }
    const onPageHide = () => writeStore({ alive: Date.now(), closedAt: Date.now() })
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      // Restored from the back/forward cache: the page was gone in between.
      const s = readStore()
      if (s?.closedAt) noteGap('closed', s.closedAt)
      lastTick = Date.now()
      writeStore({ alive: lastTick })
      beatSoon()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        touch()
        beatSoon()
      }
    }

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }))
    window.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('visibilitychange', onVisible)
    document.addEventListener('freeze', onFreeze)
    document.addEventListener('resume', onResume)
    window.addEventListener('online', beatSoon)
    window.addEventListener('offline', onOffline)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)

    beat()
    const beatId = window.setInterval(beat, BEAT_MS)
    const tickId = window.setInterval(tick, TICK_MS)
    return () => {
      window.clearInterval(beatId)
      window.clearInterval(tickId)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, touch, { capture: true }))
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('visibilitychange', onVisible)
      document.removeEventListener('freeze', onFreeze)
      document.removeEventListener('resume', onResume)
      window.removeEventListener('online', beatSoon)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])
}
