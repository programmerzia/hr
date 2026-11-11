import { create } from 'zustand'
import { usePeopleStore } from './stores/people'
import { todayKey, useAttendance } from './stores/attendance'
import type { BreakCategory, Employee, Role, User } from '../types'

const STORAGE_KEY = 'vivacom.employee_id'
/** ISO time of the last heartbeat while the person was working. Cleared when they stop working or sign out. */
export const HEARTBEAT_KEY = 'vivacom.last_heartbeat'

export function readStoredHeartbeat(): string | null {
  try {
    return localStorage.getItem(HEARTBEAT_KEY)
  } catch {
    return null
  }
}

function writeStoredHeartbeat(iso: string | null) {
  try {
    if (iso) localStorage.setItem(HEARTBEAT_KEY, iso)
    else localStorage.removeItem(HEARTBEAT_KEY)
  } catch {
    // storage unavailable; offline tracking falls back to in-memory time
  }
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage unavailable; session lasts until reload
  }
}

export type LogoutMode = 'break' | 'end_day'

interface SessionState {
  user: User | null
  employee: Employee | null
  role: Role | null
  lastHeartbeatAt: string | null
  /** Epoch ms of the last `offline` browser event not yet followed by `online`. */
  offlineSince: number | null
  /** Returns false when the employee does not exist or cannot sign in. */
  login: (employeeId: string) => boolean
  logout: (mode: LogoutMode, breakCategory?: BreakCategory) => void
  heartbeat: () => void
}

function resolve(employeeId: string | null) {
  const { employees, users } = usePeopleStore.getState()
  const employee = employeeId ? employees.find((e) => e.id === employeeId) : undefined
  const user = employee ? users.find((u) => u.employee_id === employee.id) : undefined
  if (!employee || !user) return { user: null, employee: null, role: null }
  return { user, employee, role: user.role }
}

export const useSession = create<SessionState>((set, get) => ({
  ...resolve(readStored()),
  lastHeartbeatAt: readStoredHeartbeat(),
  offlineSince: null,

  login: (employeeId) => {
    const next = resolve(employeeId)
    if (!next.employee || !['active', 'probation', 'on_leave'].includes(next.employee.status)) return false
    // Returns 'needs_overtime_confirm' for an ended day; the login page asks first and calls startWork(id, true).
    useAttendance.getState().startWork(employeeId)
    writeStored(employeeId)
    const at = new Date().toISOString()
    writeStoredHeartbeat(at)
    set({ ...next, lastHeartbeatAt: at, offlineSince: null })
    return true
  },

  logout: (mode, breakCategory) => {
    const { employee } = get()
    if (employee) {
      if (mode === 'break') {
        useAttendance.getState().startBreak(employee.id, breakCategory ?? 'signed_out')
      } else {
        useAttendance.getState().endDay(employee.id)
      }
    }
    writeStored(null)
    writeStoredHeartbeat(null)
    set({ user: null, employee: null, role: null, lastHeartbeatAt: null, offlineSince: null })
  },

  heartbeat: () => {
    const { employee } = get()
    if (!employee) return
    const nowMs = Date.now()
    // After sleep or a throttled tab the gap is offline time; record it before this beat hides it.
    const { lastHeartbeatAt } = get()
    if (lastHeartbeatAt) useAttendance.getState().reconcileOffline(employee.id, lastHeartbeatAt, nowMs)
    useAttendance.getState().heartbeat(employee.id)
    const at = new Date(nowMs).toISOString()
    set({ lastHeartbeatAt: at })
    if (isWorking(employee.id)) writeStoredHeartbeat(at)
  },
}))

function isWorking(employeeId: string): boolean {
  return useAttendance.getState().dayFor(employeeId, todayKey())?.status === 'working'
}

// Keep the persisted beat in step with the day: present only while working.
let lastDays = useAttendance.getState().days
useAttendance.subscribe((s) => {
  if (s.days === lastDays) return
  lastDays = s.days
  const employee = useSession.getState().employee
  if (!employee) return
  if (isWorking(employee.id)) {
    if (readStoredHeartbeat() === null) {
      const at = new Date().toISOString()
      writeStoredHeartbeat(at)
      useSession.setState({ lastHeartbeatAt: at })
    }
  } else {
    writeStoredHeartbeat(null)
  }
})

/** For components rendered inside the authenticated layout. */
export function useAuthed(): { user: User; employee: Employee; role: Role } {
  const { user, employee, role } = useSession()
  if (!user || !employee || !role) throw new Error('useAuthed used outside an authenticated route')
  return { user, employee, role }
}
