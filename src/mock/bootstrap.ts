// One place that wires cross-module providers. Imported once from main.tsx.
import { holidays } from './db/attendance'
import { useAttendance } from './stores/attendance'
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
