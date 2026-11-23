import { router } from '@inertiajs/react'
import { useEffect } from 'react'

/** Input events that count as "someone is here". Idle means none of these for the policy's idle timeout. */
const ACTIVITY_EVENTS = ['keydown', 'pointerdown', 'wheel', 'scroll', 'touchstart'] as const

/**
 * POST /heartbeat every 60 s while the shell is mounted; refreshes only `attendance` and `badges`.
 * Beats keep going while the tab is in the background, so by default (presence) an open tab counts as working; the
 * server records offline only after the idle timeout with no beat at all (tab closed, device asleep, no connection).
 * Each beat also carries `last_activity_at` (last keyboard / pointer / scroll / touch input, or the tab becoming
 * visible), used only when HR turns on input-based idle. The server clamps it; it is a hint only.
 * Coming back (tab visible again, connection restored) beats at once so work resumes without waiting a minute.
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
    let lastBeat = 0
    // When this device lost its connection; sent with the first beat back so the server starts the offline gap there.
    let offlineSince: number | null = navigator.onLine ? null : Date.now()
    const beat = () => {
      if (!navigator.onLine) {
        offlineSince ??= Date.now()
        return
      }
      lastBeat = Date.now()
      const since = offlineSince
      router.post(
        route('heartbeat'),
        { last_activity_at: new Date(lastActivity).toISOString(), offline_since: since ? new Date(since).toISOString() : null },
        {
          preserveState: true,
          preserveScroll: true,
          only: ['attendance', 'badges'],
          async: true,
          onSuccess: () => {
            if (offlineSince === since) offlineSince = null
          },
        },
      )
    }
    const onOffline = () => {
      offlineSince ??= Date.now()
    }
    // Back after a while (woke from sleep, reconnected, tab refocused): beat now; skip if one just went out.
    const beatSoon = () => {
      if (Date.now() - lastBeat > 15_000) beat()
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
    window.addEventListener('online', beatSoon)
    window.addEventListener('offline', onOffline)

    beat()
    const id = window.setInterval(beat, 60_000)
    return () => {
      window.clearInterval(id)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, touch, { capture: true }))
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', beatSoon)
      window.removeEventListener('offline', onOffline)
    }
  }, [])
}
