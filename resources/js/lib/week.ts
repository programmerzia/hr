import { usePage } from '@inertiajs/react'
import type { SharedProps } from '../inertia/props'

export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** First day of the work week: the first working day after the weekend (mirrors AttendancePolicy::weekStartsOn). */
export function weekStartsOn(weekend: number[] | null | undefined): WeekDay {
  const w = new Set((weekend ?? []).map(Number))
  if (w.size === 0 || w.size >= 7) return 1
  for (let d = 0; d < 7; d++) {
    if (!w.has(d) && w.has((d + 6) % 7)) return d as WeekDay
  }
  return 1
}

/** Week start from the attendance policy in force (shared on every page). */
export function useWeekStartsOn(): WeekDay {
  return weekStartsOn(usePage<SharedProps>().props.attendance?.policy?.weekend_days)
}
