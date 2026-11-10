// One place that wires cross-module providers. Imported once from main.tsx.
import { dateKey, holidays } from './db/attendance'
import { HEARTBEAT_KEY, readStoredHeartbeat, useSession } from './session'
import { todayKey, useAttendance } from './stores/attendance'
import { setHolidayProvider } from './stores/leave'
import { setTrackedSecondsProvider } from './stores/work'

setHolidayProvider(() => holidays.map((h) => h.date))

setTrackedSecondsProvider((taskId) =>
  useAttendance
    .getState()
    .taskTimeEntries.filter((e) => e.task_id === taskId)
    .reduce(
      (sum, e) =>
        sum + (e.ended_at ? e.seconds : Math.max(0, (Date.now() - new Date(e.started_at).getTime()) / 1000)),
      0,
    ),
)

// ---- offline tracking ------------------------------------------------------
// The last heartbeat is persisted while the person is working. On app start, when the tab becomes visible and when
// the network returns, a gap longer than the policy idle timeout becomes an `offline` segment (see
// attendance.reconcileOffline). Heartbeats themselves also reconcile first, so a late timer cannot hide a gap.
function reconcileNow(lastSeenIso: string | null) {
  const { employee } = useSession.getState()
  if (!employee || !lastSeenIso) return
  useAttendance.getState().reconcileOffline(employee.id, lastSeenIso, Date.now())
  useSession.setState({ lastHeartbeatAt: new Date().toISOString() })
  const day = useAttendance.getState().dayFor(employee.id, todayKey())
  if (day?.status === 'working') writeHeartbeat(new Date().toISOString())
}

function writeHeartbeat(iso: string) {
  try {
    localStorage.setItem(HEARTBEAT_KEY, iso)
  } catch {
    // ignore
  }
}

{
  // App start (including a dev reload, where attendance state is rebuilt from the seed).
  const { employee } = useSession.getState()
  const stored = readStoredHeartbeat()
  if (employee && stored) {
    const lastSeen = new Date(stored).getTime()
    if (Number.isFinite(lastSeen) && dateKey(new Date(lastSeen)) === todayKey()) {
      useAttendance.getState().restoreAfterReload(employee.id, lastSeen)
      useAttendance.getState().reconcileOffline(employee.id, stored, Date.now())
      useSession.setState({ lastHeartbeatAt: new Date().toISOString() })
      writeHeartbeat(new Date().toISOString())
    }
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') reconcileNow(useSession.getState().lastHeartbeatAt)
})
window.addEventListener('offline', () => useSession.setState({ offlineSince: Date.now() }))
window.addEventListener('online', () => {
  const since = useSession.getState().offlineSince
  useSession.setState({ offlineSince: null })
  reconcileNow(since ? new Date(since).toISOString() : useSession.getState().lastHeartbeatAt)
})
