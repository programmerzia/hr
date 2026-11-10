import { useEffect } from 'react'
import { useSession } from '../mock/session'

/** Stub for POST /heartbeat. Calls session.heartbeat() every 60 seconds while the layout is mounted. */
export function useHeartbeat() {
  const heartbeat = useSession((s) => s.heartbeat)
  useEffect(() => {
    heartbeat()
    const id = window.setInterval(heartbeat, 60_000)
    return () => window.clearInterval(id)
  }, [heartbeat])
}
