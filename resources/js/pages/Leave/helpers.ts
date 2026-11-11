import { addDays, format, parseISO } from 'date-fns'
import { formatDate } from '../../lib/format'
import type { HalfDay, ISODate } from '../../types'

export function formatRange(from: ISODate, to: ISODate): string {
  return from === to ? formatDate(from) : `${formatDate(from)} to ${formatDate(to)}`
}

export function formatDays(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

export const halfDayLabels: Record<HalfDay, string> = {
  none: 'Full day',
  first_half: 'First half',
  second_half: 'Second half',
}

export function toIso(d: Date): ISODate {
  return format(d, 'yyyy-MM-dd')
}

export function shiftDay(iso: ISODate, n: number): ISODate {
  return toIso(addDays(parseISO(iso), n))
}
