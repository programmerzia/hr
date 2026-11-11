import { usePage } from '@inertiajs/react'
import { format, parseISO } from 'date-fns'
import type { BarDatum } from '../../components/charts/Bars'
import type { HeatCell } from '../../components/charts/HeatStrip'
import { formatDuration } from '../../lib/format'

export const formatHours = (h: number) => formatDuration(Math.round(h * 3600))

/** One day of the heat strip as App\Domain\Attendance\Services\Series::heat() sends it. */
export interface HeatDay {
  date: string
  state: 'off' | 'leave' | 'pending' | 'none' | 'worked'
  work_seconds: number
  late_minutes: number
}

/** Series::monthWeeks() shape. */
export interface MonthWeeks {
  month: string
  weeks: number[]
  current: number
  days_in_month: number
}

export function heatCells(days: HeatDay[], targetSeconds: number): HeatCell[] {
  return days.map((d) => {
    const label = format(parseISO(d.date), 'EEE d MMM')
    switch (d.state) {
      case 'off':
        return { label: `${label}: day off`, value: null }
      case 'leave':
        return { label: `${label}: on leave`, value: null }
      case 'pending':
        return { label: `${label}: not started`, value: null }
      case 'none':
        return { label: `${label}: no record`, value: 0, color: 'danger' as const }
      default: {
        const late = d.late_minutes > 0 ? `, late ${d.late_minutes}m` : ''
        return {
          label: `${label}: ${formatDuration(d.work_seconds)}${late}`,
          value: Math.min(1, d.work_seconds / targetSeconds),
          color: 'success' as const,
        }
      }
    }
  })
}

export function monthBars(m: MonthWeeks) {
  const data: BarDatum[] = m.weeks.map((s, i) => ({
    label: `${i * 7 + 1}-${Math.min((i + 1) * 7, m.days_in_month)}`,
    values: [s / 3600],
    active: i === m.current ? true : undefined,
  }))
  return { data, totalSeconds: m.weeks.reduce((a, b) => a + b, 0), month: m.month }
}

const DEFAULT_TARGET = 8 * 3600

/**
 * Profile-tab hooks. They read the optional page props `heat` (Record<employeeId, HeatDay[]>) and `month_weeks`
 * (Record<employeeId, MonthWeeks>) that a controller fills from Series::heat() / Series::monthWeeks().
 */
export function useAttendanceHeat(employeeId: string, _count = 30): HeatCell[] {
  const props = usePage<{ heat?: Record<string, HeatDay[]>; attendance?: { policy?: { standard_minutes: number } } }>().props
  return heatCells(props.heat?.[employeeId] ?? [], (props.attendance?.policy?.standard_minutes ?? 480) * 60 || DEFAULT_TARGET)
}

export function useMonthWeekHours(employeeId: string) {
  const props = usePage<{ month_weeks?: Record<string, MonthWeeks> }>().props
  const m = props.month_weeks?.[employeeId]
  return m ? monthBars(m) : { data: [] as BarDatum[], totalSeconds: 0, month: format(new Date(), 'MMMM') }
}
