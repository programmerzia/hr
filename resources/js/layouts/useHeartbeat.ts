import { router } from '@inertiajs/react'
import { useEffect } from 'react'

/** Input events that count as "someone is here". Idle means none of these for the policy's idle timeout. */
const ACTIVITY_EVENTS = ['keydown', 'pointerdown', 'wheel', 'scroll', 'touchstart'] as const

/**
 * POST /heartbeat every 60 s while the shell is mounted; refreshes only `attendance` and `badges`.
 * Each beat carries `last_activity_at`: the last keyboard / pointer / scroll / touch input (or the tab becoming
 * visible), so the server can open an idle break from the real last input. The server clamps it; it is a hint only.
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
    const onVisible = () => {
      if (document.visibilityState === 'visible') touch()
    }
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }))
    window.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('visibilitychange', onVisible)

    const beat = () => {
      if (!navigator.onLine) return
      router.post(
        route('heartbeat'),
        { last_activity_at: new Date(lastActivity).toISOString() },
        { preserveState: true, preserveScroll: true, only: ['attendance', 'badges'], async: true },
      )
    }
    beat()
    const id = window.setInterval(beat, 60_000)
    return () => {
      window.clearInterval(id)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, touch, { capture: true }))
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}
