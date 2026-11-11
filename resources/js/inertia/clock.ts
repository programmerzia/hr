import { useEffect, useState } from 'react'
import type { AttendanceProp } from './props'

function offsetFor(serverTime: string | undefined): number {
  return serverTime ? new Date(serverTime).getTime() - Date.now() : 0
}

/** Server "now" in ms, ticking every second. The offset is re-measured whenever a new `server_time` arrives. */
function useServerNow(serverTime: string | undefined): number {
  const [clock, setClock] = useState(() => ({ base: serverTime, offset: offsetFor(serverTime), now: Date.now() }))
  useEffect(() => {
    const id = window.setInterval(
      () =>
        setClock((c) =>
          c.base === serverTime
            ? { ...c, now: Date.now() }
            : { base: serverTime, offset: offsetFor(serverTime), now: Date.now() },
        ),
      1000,
    )
    return () => window.clearInterval(id)
  }, [serverTime])
  return clock.now + clock.offset
}

/**
 * Today's work seconds, ticking locally between server responses.
 * Contract: `day.work_seconds` covers closed segments; an open `work` segment adds now − started_at.
 */
export function useWorkSeconds(attendance: AttendanceProp | undefined): number {
  const now = useServerNow(attendance?.server_time)
  const day = attendance?.day
  const open = attendance?.open_segment
  if (!day) return 0
  const live = open && open.type === 'work' && !open.ended_at ? Math.max(0, (now - new Date(open.started_at).getTime()) / 1000) : 0
  return Math.floor(day.work_seconds + live)
}
