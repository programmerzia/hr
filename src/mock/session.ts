import { create } from 'zustand'
import { employeeById, userByEmployeeId } from './db/people'
import { useAttendance } from './stores/attendance'
import type { BreakCategory, Employee, Role, User } from '../types'

const STORAGE_KEY = 'vivacom.employee_id'

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
  /** Returns false when the employee does not exist or cannot sign in. */
  login: (employeeId: string) => boolean
  logout: (mode: LogoutMode, breakCategory?: BreakCategory) => void
  heartbeat: () => void
}

function resolve(employeeId: string | null) {
  const employee = employeeId ? employeeById(employeeId) : undefined
  const user = employee ? userByEmployeeId(employee.id) : undefined
  if (!employee || !user) return { user: null, employee: null, role: null }
  return { user, employee, role: user.role }
}

export const useSession = create<SessionState>((set, get) => ({
  ...resolve(readStored()),
  lastHeartbeatAt: null,

  login: (employeeId) => {
    const next = resolve(employeeId)
    if (!next.employee || !['active', 'probation', 'on_leave'].includes(next.employee.status)) return false
    // Returns 'needs_overtime_confirm' for an ended day; the login page asks first and calls startWork(id, true).
    useAttendance.getState().startWork(employeeId)
    writeStored(employeeId)
    set({ ...next, lastHeartbeatAt: new Date().toISOString() })
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
    set({ user: null, employee: null, role: null, lastHeartbeatAt: null })
  },

  heartbeat: () => {
    const { employee } = get()
    if (!employee) return
    useAttendance.getState().heartbeat(employee.id)
    set({ lastHeartbeatAt: new Date().toISOString() })
  },
}))

/** For components rendered inside the authenticated layout. */
export function useAuthed(): { user: User; employee: Employee; role: Role } {
  const { user, employee, role } = useSession()
  if (!user || !employee || !role) throw new Error('useAuthed used outside an authenticated route')
  return { user, employee, role }
}
