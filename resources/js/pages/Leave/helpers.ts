import { addDays, format, getDay, parseISO } from 'date-fns'
import { formatDate } from '../../lib/format'
import type { HalfDay, ISODate, LeaveBalance, LeaveType } from '../../types'

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

export interface LeavePerson {
  id: string
  name: string
  designation: string
  team_id: string | null
}

/** A balance row as the server sends it: `available` is null for unlimited types. */
export interface BalanceRow extends LeaveBalance {
  unlimited: boolean
  available: number | null
}

export const isUnlimited = (t: LeaveType) => !t.is_paid && t.annual_quota === 0

/** Weekend defaults to Friday and Saturday (0 = Sunday). */
export function isWeekend(date: string | Date, weekend: number[] = [5, 6]): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date
  return weekend.includes(getDay(d))
}

/** Preview of the working days in a range; the server recomputes on submit. A half day counts 0.5 (single day only). */
export function computeLeaveDays(start: ISODate, end: ISODate, half: HalfDay, holidays: ISODate[], weekend: number[] = [5, 6]): number {
  if (end < start) return 0
  let count = 0
  for (let d = parseISO(start); format(d, 'yyyy-MM-dd') <= end; d = addDays(d, 1)) {
    if (!isWeekend(d, weekend) && !holidays.includes(format(d, 'yyyy-MM-dd'))) count += 1
  }
  if (half !== 'none' && start === end && count === 1) return 0.5
  return count
}

export const todayIso = (): ISODate => format(new Date(), 'yyyy-MM-dd')

/** Type names already end in "leave" ("Casual leave"); sentences that add the word use the short form. */
export const shortTypeName = (name: string) => name.replace(/\s+leave$/i, '')
