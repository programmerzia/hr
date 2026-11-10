import { addDays, addMinutes, format, getDay, set, startOfDay, subDays } from 'date-fns'
import type {
  AttendanceDay,
  AttendanceDayStatus,
  AttendancePolicy,
  BreakCategory,
  Holiday,
  RegularizationRequest,
  SegmentSource,
  TaskTimeEntry,
  TimeSegment,
} from '../../types'
import { employees } from './people'

export const attendancePolicy: AttendancePolicy = {
  shift_start: '10:00',
  shift_end: '19:00',
  grace_minutes: 15,
  standard_minutes: 480,
  idle_timeout_minutes: 10,
  lunch_cap_minutes: 60,
  late_penalty_rule: { lates_per_penalty: 3, penalty_days: 0.5 },
  weekend_days: [5, 6], // Friday, Saturday
}

export const COMPANY_TIMEZONE = 'Asia/Dhaka'

// ---------- helpers ----------

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const dateKey = (d: Date) => format(d, 'yyyy-MM-dd')

export function shiftTime(date: Date | string, hhmm: string): Date {
  const d = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date
  const [h, m] = hhmm.split(':').map(Number)
  return set(d, { hours: h, minutes: m, seconds: 0, milliseconds: 0 })
}

export const isWeekend = (d: Date) => attendancePolicy.weekend_days.includes(getDay(d))

const now = new Date()
const today = startOfDay(now)
const todayKey = dateKey(today)

export const holidays: Holiday[] = [
  { id: 'hol-1', date: '2026-02-21', name: 'International Mother Language Day' },
  { id: 'hol-2', date: '2026-03-26', name: 'Independence Day' },
  { id: 'hol-3', date: '2026-12-16', name: 'Victory Day' },
  { id: 'hol-4', date: '2026-12-25', name: 'Christmas Day' },
]
{
  // One recent company day off, relative to today, so history shows a holiday row.
  let k = 9
  let d = subDays(today, k)
  while (isWeekend(d)) d = subDays(today, ++k)
  holidays.push({ id: 'hol-5', date: dateKey(d), name: 'Company day off' })
}
const holidayDates = new Set(holidays.map((h) => h.date))
export const isHoliday = (date: string) => holidayDates.has(date)

export const attendanceDays: AttendanceDay[] = []
export const timeSegments: TimeSegment[] = []
export const taskTimeEntries: TaskTimeEntry[] = []
export const regularizationRequests: RegularizationRequest[] = []

let segN = 0
const iso = (d: Date) => d.toISOString()

interface BreakPlan {
  offset: number // minutes after first in
  length: number
  category: BreakCategory
}

function buildSegments(
  dayId: string,
  inAt: Date,
  plan: BreakPlan[],
  opts: { endAt?: Date; openBreak?: { start: Date; category: BreakCategory } },
): TimeSegment[] {
  const limit = opts.openBreak?.start ?? opts.endAt ?? now
  const out: TimeSegment[] = []
  let cursor = inAt
  let source: SegmentSource = 'login'
  const push = (type: 'work' | 'break', start: Date, end: Date | null, cat: BreakCategory | null, src: SegmentSource) =>
    out.push({
      id: `seg-${++segN}`,
      attendance_day_id: dayId,
      type,
      break_category: cat,
      started_at: iso(start),
      ended_at: end ? iso(end) : null,
      note: cat === 'official' ? 'Client meeting' : null,
      source: src,
    })
  for (const b of plan) {
    const bs = addMinutes(inAt, b.offset)
    const be = addMinutes(bs, b.length)
    if (bs <= cursor || be > addMinutes(limit, -10)) continue
    push('work', cursor, bs, null, source)
    push('break', bs, be, b.category, 'logout')
    cursor = be
    source = 'login'
  }
  if (opts.openBreak) {
    push('work', cursor, opts.openBreak.start, null, source)
    push('break', opts.openBreak.start, null, opts.openBreak.category, 'logout')
  } else if (opts.endAt) {
    push('work', cursor, opts.endAt, null, source)
  } else {
    push('work', cursor, null, null, source)
  }
  return out
}

function secondsOf(segs: TimeSegment[], type: 'work' | 'break', at: Date): number {
  return segs
    .filter((s) => s.type === type)
    .reduce((sum, s) => sum + ((s.ended_at ? new Date(s.ended_at) : at).getTime() - new Date(s.started_at).getTime()) / 1000, 0)
}

function workdaysAgo(k: number): string {
  let d = today
  let n = 0
  while (n < k) {
    d = subDays(d, 1)
    if (!isWeekend(d) && !isHoliday(dateKey(d))) n++
  }
  return dateKey(d)
}

// Forced late days so the lead of the web team always has requests to review.
const forcedLate = new Map<string, number>([
  [`emp-108|${workdaysAgo(2)}`, 38],
  [`emp-109|${workdaysAgo(3)}`, 27],
  [`emp-110|${workdaysAgo(5)}`, 52],
  [`emp-112|${workdaysAgo(6)}`, 31],
  [`emp-119|${workdaysAgo(4)}`, 44],
  [`emp-115|${workdaysAgo(7)}`, 23],
])

const todayOverrides: Record<string, 'working' | 'on_break' | 'ended' | 'not_started' | 'on_leave'> = {
  'emp-107': 'not_started',
  'emp-103': 'on_break',
  'emp-102': 'not_started',
  'emp-101': 'not_started',
  'emp-114': 'on_break',
  'emp-111': 'on_leave',
}
const todayCycle = ['working', 'working', 'on_break', 'working', 'ended', 'not_started'] as const

function addDay(
  empId: string,
  date: string,
  status: AttendanceDayStatus,
  segs: TimeSegment[],
  lateMinutes: number,
  regularized: boolean,
  closed: boolean,
) {
  const first = segs[0]
  const last = segs[segs.length - 1]
  attendanceDays.push({
    id: `att-${empId}-${date}`,
    employee_id: empId,
    date,
    status,
    first_in_at: first ? first.started_at : null,
    last_out_at: closed && last ? (last.ended_at ?? null) : null,
    work_seconds: Math.round(secondsOf(segs, 'work', now)),
    break_seconds: Math.round(secondsOf(segs, 'break', now)),
    late_minutes: lateMinutes,
    is_regularized: regularized,
  })
  timeSegments.push(...segs)
}

employees.forEach((emp, idx) => {
  const rand = mulberry32(emp.id.length * 7919 + Number(emp.id.slice(4)) * 104729)
  const r = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))
  const joined = emp.joined_on

  // ----- history: 30 days back -----
  for (let k = 30; k >= 1; k--) {
    const d = subDays(today, k)
    const key = dateKey(d)
    if (key < joined || isWeekend(d)) continue
    const id = `att-${emp.id}-${key}`
    if (isHoliday(key)) {
      addDay(emp.id, key, 'holiday', [], 0, false, true)
      continue
    }
    const roll = rand()
    const forced = forcedLate.get(`${emp.id}|${key}`)
    if (forced === undefined && roll < 0.04) {
      addDay(emp.id, key, 'absent', [], 0, false, true)
      continue
    }
    if (forced === undefined && roll < 0.08) {
      addDay(emp.id, key, 'on_leave', [], 0, false, true)
      continue
    }
    const start = shiftTime(d, attendancePolicy.shift_start)
    let delta: number
    if (forced !== undefined) delta = forced
    else if (rand() < 0.78) delta = r(-25, attendancePolicy.grace_minutes)
    else delta = r(attendancePolicy.grace_minutes + 3, 70)
    const inAt = addMinutes(start, delta)
    const lunchLen = rand() < 0.15 ? r(66, 85) : r(35, 60)
    const plan: BreakPlan[] = [
      { offset: r(60, 100), length: r(8, 18), category: 'tea' },
      { offset: r(170, 220), length: lunchLen, category: 'lunch' },
    ]
    if (rand() < 0.5) plan.push({ offset: r(330, 380), length: r(8, 15), category: 'short' })
    const breaksTotal = plan.reduce((s, b) => s + b.length, 0)
    const endAt = addMinutes(inAt, attendancePolicy.standard_minutes + breaksTotal + r(-25, 50))
    const segs = buildSegments(id, inAt, plan, { endAt })
    const late = delta > attendancePolicy.grace_minutes ? delta : 0
    const regularized = late > 0 && forced === undefined && rand() < 0.35
    addDay(emp.id, key, 'ended', segs, late, regularized, true)
  }

  // ----- today -----
  if (isWeekend(today) || isHoliday(todayKey) || todayKey < joined) return
  const id = `att-${emp.id}-${todayKey}`
  if (emp.status === 'resigned' || emp.status === 'terminated') return
  let state = todayOverrides[emp.id] ?? todayCycle[idx % todayCycle.length]
  if (state === 'on_leave') {
    addDay(emp.id, todayKey, 'on_leave', [], 0, false, true)
    return
  }
  const start = shiftTime(today, attendancePolicy.shift_start)
  const elapsedMin = (now.getTime() - start.getTime()) / 60000
  if (elapsedMin < 15) state = 'not_started'
  let inAt = addMinutes(start, r(-18, 16))
  if (state !== 'not_started') {
    const latest = addMinutes(now, -8)
    if (inAt > latest) inAt = latest
    if (state === 'ended' && (now.getTime() - inAt.getTime()) / 60000 < 200) state = 'working'
    if (state === 'on_break' && (now.getTime() - inAt.getTime()) / 60000 < 45) state = 'working'
  }
  if (state === 'not_started') {
    addDay(emp.id, todayKey, 'not_started', [], 0, false, false)
    return
  }
  const plan: BreakPlan[] = [
    { offset: r(60, 90), length: r(8, 15), category: 'tea' },
    { offset: r(150, 190), length: r(35, 62), category: 'lunch' },
  ]
  const late = (inAt.getTime() - start.getTime()) / 60000 > attendancePolicy.grace_minutes
    ? Math.round((inAt.getTime() - start.getTime()) / 60000)
    : 0
  let segs: TimeSegment[]
  if (state === 'on_break') {
    const cats: BreakCategory[] = ['tea', 'short', 'lunch', 'official']
    const openStart = addMinutes(now, -r(4, 25))
    segs = buildSegments(id, inAt, plan, { openBreak: { start: openStart, category: cats[r(0, 3)] } })
  } else if (state === 'ended') {
    segs = buildSegments(id, inAt, plan, { endAt: addMinutes(now, -r(6, 30)) })
  } else {
    segs = buildSegments(id, inAt, plan, {})
  }
  addDay(emp.id, todayKey, state, segs, late, false, state === 'ended')
})

// ----- regularization requests -----
const reasons = [
  'Traffic jam on the airport road, left home on time.',
  'Internet outage at home, joined as soon as it came back.',
  'Took my child to the clinic before work.',
  'Public transport strike this morning.',
  'Power cut and the lift was down, arrived late.',
  'Doctor appointment, informed the team on chat.',
]
let regN = 0
for (const [key, delta] of forcedLate) {
  const [empId, date] = key.split('|')
  const day = attendanceDays.find((d) => d.employee_id === empId && d.date === date)
  if (!day || delta <= 0) continue
  regN++
  const pendingForWeb = regN <= 4
  regularizationRequests.push({
    id: `reg-${regN}`,
    attendance_day_id: day.id,
    employee_id: empId,
    reason: reasons[regN - 1],
    status: pendingForWeb ? 'pending' : regN === 5 ? 'approved' : 'rejected',
    decided_by: pendingForWeb ? null : regN === 5 ? 'emp-105' : 'emp-104',
    decided_at: pendingForWeb ? null : iso(addDays(new Date(`${date}T12:00:00`), 1)),
    note: pendingForWeb ? null : regN === 5 ? 'Confirmed with the transport notice.' : 'No prior message to the team.',
    created_at: iso(addMinutes(new Date(`${date}T10:00:00`), 24 * 60 + 5)),
  })
  if (regN === 5) day.is_regularized = true
}
