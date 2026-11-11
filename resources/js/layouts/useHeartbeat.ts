import { router } from '@inertiajs/react'
import { useEffect } from 'react'

/** POST /heartbeat every 60 s while the shell is mounted; refreshes only `attendance` and `badges`. */
export function useHeartbeat() {
  useEffect(() => {
    const beat = () => {
      if (!navigator.onLine) return
      router.post(route('heartbeat'), {}, { preserveState: true, preserveScroll: true, only: ['attendance', 'badges'], async: true })
    }
    beat()
    const id = window.setInterval(beat, 60_000)
    return () => window.clearInterval(id)
  }, [])
}
