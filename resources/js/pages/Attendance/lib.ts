import { useEffect, useState } from 'react'
import { breakCategoryLabels } from '../../lib/status'
import type { AttendanceDay, AttendanceDayStatus, TimeSegment } from '../../types'

/** Day totals as DayCalculator returns them (server computes; the client only adds the open segment's elapsed time). */
export interface DayTotals {
  work_seconds: number
  break_seconds: number
  idle_seconds: number
  offline_seconds: number
  lunch_over_cap_minutes: number
}

export const EMPTY_TOTALS: DayTotals = {
  work_seconds: 0,
  break_seconds: 0,
  idle_seconds: 0,
  offline_seconds: 0,
  lunch_over_cap_minutes: 0,
}

/** Server "now" in ms, ticking each second from the `server_time` that arrived with the props (same scheme as inertia/clock.ts). */
export function useServerNow(serverTime: string): number {
  const offsetFor = (t: string) => new Date(t).getTime() - Date.now()
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

/** Totals as of the server response plus the time the open segment has run since (only that segment ticks). */
export function liveTotals(totals: DayTotals, open: TimeSegment | null | undefined, serverTime: string, nowMs: number): DayTotals {
  if (!open || open.ended_at) return totals
  const delta = Math.max(0, (nowMs - new Date(serverTime).getTime()) / 1000)
  const t = { ...totals }
  if (open.type === 'work') t.work_seconds += delta
  else if (open.break_category === 'idle') t.idle_seconds += delta
  else if (open.break_category === 'offline') t.offline_seconds += delta
  else t.break_seconds += delta
  return t
}

export function breakLabel(seg: TimeSegment | undefined): string {
  if (!seg || seg.type !== 'break') return ''
  return breakCategoryLabels[seg.break_category ?? 'short'] ?? 'Break'
}

export function dayStatus(day: AttendanceDay | null | undefined): AttendanceDayStatus {
  return day?.status ?? 'not_started'
}

export type GradeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/** Day grade chip: Full / Half day / Absent / Excused / Paid leave / Unpaid leave (null for weekends and holidays). */
export function dayGrade(day: AttendanceDay | null | undefined): { label: string; variant: GradeVariant } | null {
  if (!day) return null
  switch (day.absence_kind) {
    case 'weekend':
    case 'holiday':
      return null
    case 'excused':
      return { label: 'Excused', variant: 'info' }
    case 'paid_leave':
      return { label: day.day_fraction >= 1 ? 'Paid leave' : 'Half paid leave', variant: 'info' }
    case 'unpaid_leave':
      return { label: day.day_fraction > 0 ? 'Half unpaid' : 'Unpaid leave', variant: 'warning' }
    case 'unapproved':
      return { label: day.day_fraction > 0 ? 'Half day' : 'Absent', variant: 'danger' }
    case 'half_day':
      return { label: 'Half day', variant: 'warning' }
    default:
      return { label: 'Full', variant: 'success' }
  }
}

export const regularizationKindLabels: Record<string, string> = {
  late: 'Late arrival',
  early: 'Early leave',
  absent: 'Absence',
  auto_closed: 'Auto-closed day',
  overtime: 'Overtime',
}

export const resolutionLabels: Record<string, string> = {
  excused: 'Excused (no deduction)',
  paid_leave: 'Paid leave (uses balance)',
  unpaid_leave: 'Unpaid leave',
  keep: 'Keep as graded',
}

/** Regularisation kinds that apply to a closed or running day. */
export function regularizableKinds(day: AttendanceDay): ('late' | 'early' | 'absent' | 'auto_closed')[] {
  if (day.is_regularized) return []
  const kinds: ('late' | 'early' | 'absent' | 'auto_closed')[] = []
  if (day.late_minutes > 0) kinds.push('late')
  if (day.early_minutes > 0) kinds.push('early')
  if (day.absence_kind === 'unapproved' || day.absence_kind === 'half_day' || day.status === 'absent') kinds.push('absent')
  if (day.auto_closed) kinds.push('auto_closed')
  return kinds
}
