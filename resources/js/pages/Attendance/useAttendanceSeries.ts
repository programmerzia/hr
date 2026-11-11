import { addDays, format, startOfWeek, subDays } from 'date-fns'
import { useMemo } from 'react'
import type { BarDatum } from '../../components/charts/Bars'
import type { HeatCell } from '../../components/charts/HeatStrip'
import { formatDuration } from '../../lib/format'
import { attendancePolicy, dateKey, isHoliday, isWeekend } from '../../mock/db/attendance'
import { useAttendance } from '../../mock/stores/attendance'
import { totalsOf, useSegmentsByDay } from './lib'

export const targetSeconds = () => attendancePolicy.standard_minutes * 60

/** Today's work against the daily target, for the Ring on Home and My day. */
export function useTodayProgress(employeeId: string) {
  const now = useAttendance((s) => s.now)
  const days = useAttendance((s) => s.days)
  const segsByDay = useSegmentsByDay()
  const today = dateKey(new Date(now))
  const day = days.find((d) => d.employee_id === employeeId && d.date === today)
  const workSeconds = totalsOf(day && segsByDay.get(day.id), now).workSeconds
  const target = targetSeconds()
  return { workSeconds, target, pct: Math.min(100, Math.round((workSeconds / target) * 100)), status: day?.status ?? 'not_started' }
}

/** Work hours per day for the current week (Sunday to Saturday), with the daily target. */
export function useWeeklyHours(employeeId: string) {
  const now = useAttendance((s) => s.now)
  const days = useAttendance((s) => s.days)
  const segsByDay = useSegmentsByDay()
  return useMemo(() => {
    const start = startOfWeek(new Date(now))
    const today = dateKey(new Date(now))
    const data: BarDatum[] = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i)
      const key = dateKey(d)
      const rec = days.find((x) => x.employee_id === employeeId && x.date === key)
      const secs = rec ? totalsOf(segsByDay.get(rec.id), now).workSeconds : 0
      return { label: format(d, 'EEE'), values: [secs / 3600], active: key === today ? true : undefined }
    })
    const total = data.reduce((a, d) => a + (d.values[0] ?? 0) * 3600, 0)
    const workdays = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => !isWeekend(d) && !isHoliday(dateKey(d))).length
    return { data, totalSeconds: Math.round(total), workdays, targetHours: targetSeconds() / 3600 }
  }, [now, days, segsByDay, employeeId])
}

export const formatHours = (h: number) => formatDuration(Math.round(h * 3600))

/** Last N days of attendance for one person: intensity is work against target. Weekends and holidays have no data. */
export function useAttendanceHeat(employeeId: string, count = 30): HeatCell[] {
  // Minute granularity: the strip only changes when today's total does.
  const minute = useAttendance((s) => Math.floor(s.now / 60_000))
  const days = useAttendance((s) => s.days)
  const segsByDay = useSegmentsByDay()
  return useMemo(() => {
    const now = minute * 60_000
    const end = new Date(now)
    const mine = days.filter((x) => x.employee_id === employeeId)
    return Array.from({ length: count }, (_, i) => {
      const d = subDays(end, count - 1 - i)
      const key = dateKey(d)
      const label = format(d, 'EEE d MMM')
      if (isWeekend(d) || isHoliday(key)) return { label: `${label}: day off`, value: null }
      const rec = mine.find((x) => x.date === key)
      if (!rec || !rec.first_in_at) {
        if (key >= dateKey(end) || rec?.status === 'on_leave') {
          return { label: `${label}: ${rec?.status === 'on_leave' ? 'on leave' : 'not started'}`, value: null }
        }
        return { label: `${label}: no record`, value: 0, color: 'danger' as const }
      }
      const secs = totalsOf(segsByDay.get(rec.id), now).workSeconds
      const late = rec.late_minutes > 0 ? `, late ${rec.late_minutes}m` : ''
      return { label: `${label}: ${formatDuration(secs)}${late}`, value: Math.min(1, secs / targetSeconds()), color: 'success' as const }
    })
  }, [minute, days, segsByDay, employeeId, count])
}

/** Hours worked per calendar week of the current month (days 1-7, 8-14, ...). */
export function useMonthWeekHours(employeeId: string) {
  const minute = useAttendance((s) => Math.floor(s.now / 60_000))
  const days = useAttendance((s) => s.days)
  const segsByDay = useSegmentsByDay()
  return useMemo(() => {
    const now = minute * 60_000
    const d0 = new Date(now)
    const prefix = format(d0, 'yyyy-MM')
    const last = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate()
    const weeks = Math.ceil(last / 7)
    const secs = Array.from({ length: weeks }, () => 0)
    for (const d of days) {
      if (d.employee_id !== employeeId || !d.date.startsWith(prefix)) continue
      const w = Math.floor((Number(d.date.slice(8)) - 1) / 7)
      secs[w] = (secs[w] ?? 0) + totalsOf(segsByDay.get(d.id), now).workSeconds
    }
    const currentWeek = Math.floor((d0.getDate() - 1) / 7)
    const data: BarDatum[] = secs.map((s, i) => ({
      label: `${i * 7 + 1}-${Math.min((i + 1) * 7, last)}`,
      values: [s / 3600],
      active: i === currentWeek ? true : undefined,
    }))
    return { data, totalSeconds: secs.reduce((a, b) => a + b, 0), month: format(d0, 'MMMM') }
  }, [minute, days, segsByDay, employeeId])
}
