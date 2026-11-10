import { create } from 'zustand'
import { onTick } from '../clock'
import {
  attendanceDays,
  attendancePolicy,
  dateKey,
  regularizationRequests,
  shiftTime,
  taskTimeEntries,
  timeSegments,
} from '../db/attendance'
import { employees, teamMembersOf, userByEmployeeId } from '../db/people'
import type {
  AttendanceDay,
  BreakCategory,
  Employee,
  RegularizationRequest,
  Role,
  TaskTimeEntry,
  TimeSegment,
} from '../../types'

export type StartWorkResult =
  | 'started'
  | 'resumed'
  | 'already_working'
  | 'overtime_started'
  | 'needs_overtime_confirm'

export interface Presence {
  /** True when the day is `working` but the last heartbeat is older than PRESENCE_STALE_MS. */
  offline: boolean
  /** ISO time of the last heartbeat when offline. */
  since: string | null
}

export const PRESENCE_STALE_MS = 2 * 60_000

export type RegularizationDecision = 'approved' | 'rejected'

export interface DayTotals {
  workSeconds: number
  /** User-chosen breaks only. Idle and offline time are reported separately and are not worked. */
  breakSeconds: number
  idleSeconds: number
  offlineSeconds: number
  /** Lunch minutes over the policy cap (0 when within it). */
  lunchOverCapMinutes: number
}

interface AttendanceState {
  /** Epoch ms, refreshed by the shared 1s clock. Components that need live numbers select this. */
  now: number
  days: AttendanceDay[]
  segments: TimeSegment[]
  taskTimeEntries: TaskTimeEntry[]
  regularizations: RegularizationRequest[]
  /** Last heartbeat per employee (epoch ms). Only employees who sent one are idle-swept. */
  heartbeats: Record<string, number>
  /** Selected current task per employee; re-applied when work resumes after a break. */
  currentTask: Record<string, string | null>

  // actions (mirror the future Laravel actions)
  startWork: (employeeId: string, confirmOvertime?: boolean) => StartWorkResult
  startBreak: (employeeId: string, category: BreakCategory, note?: string) => boolean
  endDay: (employeeId: string) => boolean
  heartbeat: (employeeId: string) => void
  /**
   * Called on app start, tab visible and network back. When the gap since `lastSeenIso` exceeds the policy idle
   * timeout and the person was working (or on an idle break that began at the last heartbeat), the gap becomes an
   * `offline` segment and work resumes. Returns true when the day changed.
   */
  reconcileOffline: (employeeId: string, lastSeenIso: string, nowMs: number) => boolean
  /** Rebuilds a working day after a reload of the in-memory mock: work from the last heartbeat. */
  restoreAfterReload: (employeeId: string, lastSeenMs: number) => boolean
  presenceOf: (employeeId: string, nowMs?: number) => Presence
  setCurrentTask: (employeeId: string, taskId: string | null) => void
  requestRegularization: (dayId: string, reason: string) => RegularizationRequest | null
  decideRegularization: (
    id: string,
    decision: RegularizationDecision,
    note: string,
    deciderId: string,
  ) => boolean

  // selectors
  dayFor: (employeeId: string, date: string) => AttendanceDay | undefined
  segmentsFor: (dayId: string) => TimeSegment[]
  totalsFor: (dayId: string, nowMs?: number) => DayTotals
  teamOf: (leadEmployeeId: string) => Employee[]
  taskSecondsFor: (employeeId: string, taskId: string, nowMs?: number) => number
}

export const todayKey = () => dateKey(new Date())

function segSeconds(s: TimeSegment, nowMs: number): number {
  const end = s.ended_at ? new Date(s.ended_at).getTime() : nowMs
  return Math.max(0, (end - new Date(s.started_at).getTime()) / 1000)
}

export function computeTotals(segments: TimeSegment[], nowMs: number): DayTotals {
  let work = 0
  let brk = 0
  let idle = 0
  let offline = 0
  let lunch = 0
  for (const s of segments) {
    const secs = segSeconds(s, nowMs)
    if (s.type === 'work') work += secs
    else if (s.break_category === 'idle') idle += secs
    else if (s.break_category === 'offline') offline += secs
    else {
      brk += secs
      if (s.break_category === 'lunch') lunch += secs
    }
  }
  return {
    workSeconds: work,
    breakSeconds: brk,
    idleSeconds: idle,
    offlineSeconds: offline,
    lunchOverCapMinutes: Math.max(0, Math.floor(lunch / 60) - attendancePolicy.lunch_cap_minutes),
  }
}

/** Who a viewer may see: lead = own team(s), hr/management = everyone, employee = self. */
export function scopeEmployees(viewerEmployeeId: string, role: Role): Employee[] {
  if (role === 'hr' || role === 'management') return employees.filter((e) => e.exited_on === null)
  if (role === 'team_lead') {
    const own = teamMembersOf(viewerEmployeeId)
    return own.some((e) => e.id === viewerEmployeeId) ? own : [...own, ...employees.filter((e) => e.id === viewerEmployeeId)]
  }
  return employees.filter((e) => e.id === viewerEmployeeId)
}

/**
 * Last-seen times for the seeded team (not the signed-in person, who uses `heartbeats`). Live members are refreshed
 * every tick to simulate their clients; two working members stay stale so team views have offline rows.
 * Kept outside the zustand state: it changes every second and views already re-render on `now`.
 */
const peerBeats = new Map<string, number>()
const stalePeers = new Map<string, number>()
{
  const t0 = Date.now()
  const todayStr = dateKey(new Date(t0))
  const working = attendanceDays
    .filter((d) => d.date === todayStr && d.status === 'working')
    .map((d) => d.employee_id)
    .sort((a, b) => {
      const wa = employees.find((e) => e.id === a)?.team_id === 'team-web' ? 0 : 1
      const wb = employees.find((e) => e.id === b)?.team_id === 'team-web' ? 0 : 1
      return wa - wb || a.localeCompare(b)
    })
  const staleMinutes = [15, 7]
  working.forEach((id, i) => {
    if (i < staleMinutes.length) {
      stalePeers.set(id, t0 - staleMinutes[i]! * 60_000)
      peerBeats.set(id, t0 - staleMinutes[i]! * 60_000)
    } else peerBeats.set(id, t0 - 3000)
  })
}

let segCounter = 100000
let entryCounter = 0
const nextSegId = () => `seg-rt-${++segCounter}`

export const useAttendance = create<AttendanceState>((set, get) => {
  const iso = (ms: number) => new Date(ms).toISOString()

  /** Closes the employee's open task entry (if any) at `atMs`. */
  const closeEntries = (entries: TaskTimeEntry[], employeeId: string, atMs: number): TaskTimeEntry[] =>
    entries.map((e) =>
      e.employee_id === employeeId && e.ended_at === null
        ? { ...e, ended_at: iso(atMs), seconds: Math.max(0, Math.round((atMs - new Date(e.started_at).getTime()) / 1000)) }
        : e,
    )

  const openEntry = (employeeId: string, segId: string, taskId: string, atMs: number): TaskTimeEntry => ({
    id: `tte-rt-${++entryCounter}`,
    time_segment_id: segId,
    task_id: taskId,
    employee_id: employeeId,
    started_at: iso(atMs),
    ended_at: null,
    seconds: 0,
  })

  /** Returns the day for today, creating an empty one when the employee has none yet. */
  const ensureToday = (employeeId: string): AttendanceDay => {
    const date = todayKey()
    const found = get().days.find((d) => d.employee_id === employeeId && d.date === date)
    if (found) return found
    const created: AttendanceDay = {
      id: `att-${employeeId}-${date}`,
      employee_id: employeeId,
      date,
      status: 'not_started',
      first_in_at: null,
      last_out_at: null,
      work_seconds: 0,
      break_seconds: 0,
      late_minutes: 0,
      is_regularized: false,
    }
    set((s) => ({ days: [...s.days, created] }))
    return created
  }

  const patchDay = (days: AttendanceDay[], id: string, patch: Partial<AttendanceDay>) =>
    days.map((d) => (d.id === id ? { ...d, ...patch } : d))

  const closeOpen = (segs: TimeSegment[], dayId: string, atMs: number) =>
    segs.map((x) => (x.attendance_day_id === dayId && x.ended_at === null ? { ...x, ended_at: iso(atMs) } : x))

  /** Opens a work segment (and a task entry when a task is selected). */
  const openWork = (
    employeeId: string,
    day: AttendanceDay,
    atMs: number,
    note: string | null,
    patch: Partial<AttendanceDay>,
  ) => {
    const seg: TimeSegment = {
      id: nextSegId(),
      attendance_day_id: day.id,
      type: 'work',
      break_category: null,
      started_at: iso(atMs),
      ended_at: null,
      note,
      source: 'login',
    }
    const task = get().currentTask[employeeId] ?? null
    set((s) => ({
      segments: [...closeOpen(s.segments, day.id, atMs), seg],
      days: patchDay(s.days, day.id, { status: 'working', last_out_at: null, ...patch }),
      taskTimeEntries: task ? [...s.taskTimeEntries, openEntry(employeeId, seg.id, task, atMs)] : s.taskTimeEntries,
      heartbeats: { ...s.heartbeats, [employeeId]: atMs },
    }))
  }

  const leaveWork = (employeeId: string, day: AttendanceDay, atMs: number) => {
    set((s) => ({
      taskTimeEntries: closeEntries(s.taskTimeEntries, employeeId, atMs),
      heartbeats: Object.fromEntries(Object.entries(s.heartbeats).filter(([k]) => k !== employeeId)),
      segments: closeOpen(s.segments, day.id, atMs),
    }))
  }

  return {
    now: Date.now(),
    days: attendanceDays,
    segments: timeSegments,
    taskTimeEntries,
    regularizations: regularizationRequests,
    heartbeats: {},
    currentTask: {},

    startWork: (employeeId, confirmOvertime = false) => {
      const day = ensureToday(employeeId)
      const nowMs = Date.now()
      if (day.status === 'working') {
        set((s) => ({ heartbeats: { ...s.heartbeats, [employeeId]: nowMs } }))
        return 'already_working'
      }
      if (day.status === 'on_break') {
        openWork(employeeId, day, nowMs, null, {})
        return 'resumed'
      }
      if (day.status === 'ended') {
        if (!confirmOvertime) return 'needs_overtime_confirm'
        openWork(employeeId, day, nowMs, 'Overtime session', {})
        return 'overtime_started'
      }
      // not_started, on_leave, absent, holiday: first sign-in of the day
      const start = shiftTime(new Date(nowMs), attendancePolicy.shift_start).getTime()
      const lateBy = Math.round((nowMs - start) / 60000)
      openWork(employeeId, day, nowMs, null, {
        first_in_at: iso(nowMs),
        late_minutes: lateBy > attendancePolicy.grace_minutes ? lateBy : 0,
      })
      return 'started'
    },

    startBreak: (employeeId, category, note) => {
      const day = get().days.find((d) => d.employee_id === employeeId && d.date === todayKey())
      if (!day || day.status !== 'working') return false
      const nowMs = Date.now()
      leaveWork(employeeId, day, nowMs)
      const seg: TimeSegment = {
        id: nextSegId(),
        attendance_day_id: day.id,
        type: 'break',
        break_category: category,
        started_at: iso(nowMs),
        ended_at: null,
        note: note?.trim() ? note.trim() : null,
        source: 'logout',
      }
      set((s) => ({ segments: [...s.segments, seg], days: patchDay(s.days, day.id, { status: 'on_break' }) }))
      return true
    },

    endDay: (employeeId) => {
      const day = get().days.find((d) => d.employee_id === employeeId && d.date === todayKey())
      if (!day || (day.status !== 'working' && day.status !== 'on_break')) return false
      const nowMs = Date.now()
      leaveWork(employeeId, day, nowMs)
      const totals = computeTotals(
        get().segments.filter((x) => x.attendance_day_id === day.id),
        nowMs,
      )
      set((s) => ({
        days: patchDay(s.days, day.id, {
          status: 'ended',
          last_out_at: iso(nowMs),
          work_seconds: Math.round(totals.workSeconds),
          break_seconds: Math.round(totals.breakSeconds + totals.idleSeconds + totals.offlineSeconds),
        }),
      }))
      return true
    },

    heartbeat: (employeeId) => {
      const nowMs = Date.now()
      const day = get().days.find((d) => d.employee_id === employeeId && d.date === todayKey())
      if (day?.status === 'on_break') {
        const open = get().segments.find((x) => x.attendance_day_id === day.id && x.ended_at === null)
        // Next activity closes an idle break.
        if (open?.break_category === 'idle') openWork(employeeId, day, nowMs, null, {})
        return
      }
      if (day?.status === 'working') set((s) => ({ heartbeats: { ...s.heartbeats, [employeeId]: nowMs } }))
    },

    reconcileOffline: (employeeId, lastSeenIso, nowMs) => {
      const idleMs = attendancePolicy.idle_timeout_minutes * 60_000
      let lastSeen = new Date(lastSeenIso).getTime()
      if (!Number.isFinite(lastSeen) || nowMs - lastSeen <= idleMs) return false
      const day = get().days.find((d) => d.employee_id === employeeId && d.date === todayKey())
      if (!day) return false
      const open = get().segments.find((x) => x.attendance_day_id === day.id && x.ended_at === null)
      if (!open) return false
      let convertIdle = false
      if (day.status === 'working' && open.type === 'work') {
        // A heartbeat from before this work segment started says nothing about it.
        lastSeen = Math.max(lastSeen, new Date(open.started_at).getTime())
        if (nowMs - lastSeen <= idleMs) return false
      } else if (
        day.status === 'on_break' &&
        open.break_category === 'idle' &&
        new Date(open.started_at).getTime() >= lastSeen - 5000
      ) {
        convertIdle = true
        lastSeen = new Date(open.started_at).getTime()
      } else {
        // On a break the person chose, or the day is not running: the gap is not extra lost time.
        return false
      }
      const offlineSeg: TimeSegment = {
        id: nextSegId(),
        attendance_day_id: day.id,
        type: 'break',
        break_category: 'offline',
        started_at: iso(lastSeen),
        ended_at: iso(nowMs),
        note: 'App closed or no connection',
        source: 'offline',
      }
      const work: TimeSegment = {
        id: nextSegId(),
        attendance_day_id: day.id,
        type: 'work',
        break_category: null,
        started_at: iso(nowMs),
        ended_at: null,
        note: null,
        source: 'login',
      }
      const task = get().currentTask[employeeId] ?? null
      set((s) => {
        let segments: TimeSegment[]
        if (convertIdle) {
          segments = s.segments.map((x) => (x.id === open.id ? { ...offlineSeg, id: x.id } : x))
        } else {
          // Close the open work segment where the last heartbeat was; an empty remainder is dropped.
          segments = s.segments
            .map((x) => (x.id === open.id ? { ...x, ended_at: iso(lastSeen) } : x))
            .filter((x) => !(x.id === open.id && lastSeen <= new Date(x.started_at).getTime()))
          segments.push(offlineSeg)
        }
        segments.push(work)
        return {
          segments,
          days: patchDay(s.days, day.id, { status: 'working', last_out_at: null }),
          taskTimeEntries: [
            ...closeEntries(s.taskTimeEntries, employeeId, lastSeen),
            ...(task ? [openEntry(employeeId, work.id, task, nowMs)] : []),
          ],
          heartbeats: { ...s.heartbeats, [employeeId]: nowMs },
        }
      })
      return true
    },

    restoreAfterReload: (employeeId, lastSeenMs) => {
      const day = ensureToday(employeeId)
      if (day.status !== 'not_started') return false
      // The real first sign-in is unknown (the mock lost it on reload), so no lateness is invented.
      openWork(employeeId, day, lastSeenMs, null, { first_in_at: iso(lastSeenMs), late_minutes: 0 })
      return true
    },

    presenceOf: (employeeId, nowMs) => {
      const at = nowMs ?? Date.now()
      const day = get().days.find((d) => d.employee_id === employeeId && d.date === todayKey())
      if (!day || day.status !== 'working') return { offline: false, since: null }
      const last = get().heartbeats[employeeId] ?? peerBeats.get(employeeId)
      if (last === undefined || at - last <= PRESENCE_STALE_MS) return { offline: false, since: null }
      return { offline: true, since: iso(last) }
    },

    setCurrentTask: (employeeId, taskId) => {
      const nowMs = Date.now()
      const day = get().days.find((d) => d.employee_id === employeeId && d.date === todayKey())
      set((s) => ({ currentTask: { ...s.currentTask, [employeeId]: taskId } }))
      if (!day || day.status !== 'working') return
      const openSeg = get().segments.find((x) => x.attendance_day_id === day.id && x.ended_at === null && x.type === 'work')
      set((s) => ({
        taskTimeEntries: [
          ...closeEntries(s.taskTimeEntries, employeeId, nowMs),
          ...(taskId && openSeg ? [openEntry(employeeId, openSeg.id, taskId, nowMs)] : []),
        ],
      }))
    },

    requestRegularization: (dayId, reason) => {
      const { days, regularizations } = get()
      const day = days.find((d) => d.id === dayId)
      if (!day || day.late_minutes <= 0 || day.is_regularized || !reason.trim()) return null
      if (regularizations.some((r) => r.attendance_day_id === dayId && r.status === 'pending')) return null
      const req: RegularizationRequest = {
        id: `reg-rt-${regularizations.length + 1}`,
        attendance_day_id: dayId,
        employee_id: day.employee_id,
        reason: reason.trim(),
        status: 'pending',
        decided_by: null,
        decided_at: null,
        note: null,
        created_at: new Date().toISOString(),
      }
      set((s) => ({ regularizations: [req, ...s.regularizations] }))
      return req
    },

    decideRegularization: (id, decision, note, deciderId) => {
      const req = get().regularizations.find((r) => r.id === id)
      const decider = userByEmployeeId(deciderId)
      if (!req || req.status !== 'pending' || !decider) return false
      if (!scopeEmployees(deciderId, decider.role).some((e) => e.id === req.employee_id)) return false
      if (decider.role === 'employee' || req.employee_id === deciderId) return false
      set((s) => ({
        regularizations: s.regularizations.map((r) =>
          r.id === id
            ? { ...r, status: decision, decided_by: deciderId, decided_at: new Date().toISOString(), note: note.trim() || null }
            : r,
        ),
        days: decision === 'approved' ? patchDay(s.days, req.attendance_day_id, { is_regularized: true }) : s.days,
      }))
      return true
    },

    dayFor: (employeeId, date) => get().days.find((d) => d.employee_id === employeeId && d.date === date),
    segmentsFor: (dayId) => get().segments.filter((x) => x.attendance_day_id === dayId),
    totalsFor: (dayId, nowMs) =>
      computeTotals(
        get().segments.filter((x) => x.attendance_day_id === dayId),
        nowMs ?? get().now,
      ),
    teamOf: (leadEmployeeId) => teamMembersOf(leadEmployeeId),
    taskSecondsFor: (employeeId, taskId, nowMs) => {
      const at = nowMs ?? get().now
      return get()
        .taskTimeEntries.filter((e) => e.employee_id === employeeId && e.task_id === taskId)
        .reduce(
          (sum, e) =>
            sum + (e.ended_at ? e.seconds : Math.max(0, (at - new Date(e.started_at).getTime()) / 1000)),
          0,
        )
    },
  }
})

// ---- live tick + idle sweep (single subscription) ----
onTick((now) => {
  const nowMs = now.getTime()
  for (const id of peerBeats.keys()) if (!stalePeers.has(id)) peerBeats.set(id, nowMs - 3000)
  const state = useAttendance.getState()
  const idleMs = attendancePolicy.idle_timeout_minutes * 60_000
  const date = dateKey(now)
  for (const [employeeId, last] of Object.entries(state.heartbeats)) {
    if (nowMs - last < idleMs) continue
    const day = state.days.find((d) => d.employee_id === employeeId && d.date === date)
    if (!day || day.status !== 'working') continue
    // Open an idle break starting at the last heartbeat.
    const seg: TimeSegment = {
      id: nextSegId(),
      attendance_day_id: day.id,
      type: 'break',
      break_category: 'idle',
      started_at: new Date(last).toISOString(),
      ended_at: null,
      note: 'No activity detected',
      source: 'idle_sweep',
    }
    useAttendance.setState((s) => ({
      segments: [
        ...s.segments.map((x) =>
          x.attendance_day_id === day.id && x.ended_at === null
            ? { ...x, ended_at: new Date(last).toISOString() }
            : x,
        ),
        seg,
      ],
      days: s.days.map((d) => (d.id === day.id ? { ...d, status: 'on_break' } : d)),
      taskTimeEntries: s.taskTimeEntries.map((e) =>
        e.employee_id === employeeId && e.ended_at === null
          ? { ...e, ended_at: new Date(last).toISOString(), seconds: Math.max(0, Math.round((last - new Date(e.started_at).getTime()) / 1000)) }
          : e,
      ),
    }))
  }
  useAttendance.setState({ now: nowMs })
})
