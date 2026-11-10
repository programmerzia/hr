import { useMemo } from 'react'
import { breakCategoryLabels } from '../../lib/status'
import { dateKey } from '../../mock/db/attendance'
import { computeTotals, useAttendance, type DayTotals } from '../../mock/stores/attendance'
import type { AttendanceDay, AttendanceDayStatus, TimeSegment } from '../../types'

export const EMPTY_TOTALS: DayTotals = { workSeconds: 0, breakSeconds: 0, lunchOverCapMinutes: 0 }

/** Segments grouped by attendance day id; recomputed only when segments change. */
export function useSegmentsByDay(): Map<string, TimeSegment[]> {
  const segments = useAttendance((s) => s.segments)
  return useMemo(() => {
    const map = new Map<string, TimeSegment[]>()
    for (const s of segments) {
      const list = map.get(s.attendance_day_id)
      if (list) list.push(s)
      else map.set(s.attendance_day_id, [s])
    }
    return map
  }, [segments])
}

export function totalsOf(segs: TimeSegment[] | undefined, nowMs: number): DayTotals {
  return segs && segs.length ? computeTotals(segs, nowMs) : EMPTY_TOTALS
}

export const todayString = () => dateKey(new Date())

export function breakLabel(seg: TimeSegment | undefined): string {
  if (!seg || seg.type !== 'break') return ''
  return breakCategoryLabels[seg.break_category ?? 'short'] ?? 'Break'
}

export function dayStatus(day: AttendanceDay | undefined): AttendanceDayStatus {
  return day?.status ?? 'not_started'
}

export function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const body = rows.map((r) => r.map(csvCell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
