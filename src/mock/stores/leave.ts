import { create } from 'zustand'
import { persistStore } from '../persist'
import { navBadges } from '../../app/nav'
import type {
  HalfDay,
  Id,
  ISODate,
  LeaveApproval,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  Role,
} from '../../types'
import * as seed from '../db/leave'
import { useSession } from '../session'
import { todayIso, usePeopleStore, type Result } from './people'

export { computeLeaveDays, isWeekend } from '../db/leave'

let holidayProvider: () => ISODate[] = () => []

/** Attendance owns the holiday list; it can plug it in here. Defaults to none. */
export function setHolidayProvider(fn: () => ISODate[]) {
  holidayProvider = fn
}

export interface Viewer {
  employeeId: Id
  role: Role
}

export interface BalanceView extends LeaveBalance {
  type: LeaveType
  unlimited: boolean
  /** entitled - used - pending; Infinity for unlimited types. */
  available: number
}

export const isUnlimited = (t: LeaveType) => !t.is_paid && t.annual_quota === 0

const ACTIVE = ['pending_lead', 'pending_hr', 'approved'] as const

const overlaps = (a: LeaveRequest, from: ISODate, to: ISODate) => a.starts_on <= to && a.ends_on >= from

interface LeaveState {
  leaveTypes: LeaveType[]
  balances: LeaveBalance[]
  requests: LeaveRequest[]
  approvals: LeaveApproval[]

  submitLeave: (
    employeeId: Id,
    typeId: Id,
    startsOn: ISODate,
    endsOn: ISODate,
    halfDay: HalfDay,
    reason: string,
    attachmentName?: string,
  ) => Result<LeaveRequest>
  approveAsLead: (id: Id, deciderId: Id, note?: string) => Result<LeaveRequest>
  approveAsHr: (id: Id, deciderId: Id, note?: string) => Result<LeaveRequest>
  reject: (id: Id, stage: 'lead' | 'hr', deciderId: Id, note: string) => Result<LeaveRequest>
  cancel: (id: Id) => Result<LeaveRequest>
  updateLeaveType: (id: Id, patch: Partial<Omit<LeaveType, 'id'>>) => void

  balancesFor: (employeeId: Id, year: number) => BalanceView[]
  requestsFor: (employeeId: Id) => LeaveRequest[]
  pendingFor: (viewer: Viewer) => LeaveRequest[]
  overlapsFor: (request: LeaveRequest) => LeaveRequest[]
  approvalsFor: (requestId: Id) => LeaveApproval[]
  /** Balance after the request is approved (current available minus its days if still pending). */
  balanceAfter: (request: LeaveRequest) => number | null
  /** Approved leave overlapping the date, for calendars. */
  approvedOn: (date: ISODate) => LeaveRequest[]
  daysFor: (startsOn: ISODate, endsOn: ISODate, halfDay: HalfDay) => number
}

const fail = <T>(error: string): Result<T> => ({ ok: false, error })

function adjust(
  balances: LeaveBalance[],
  r: LeaveRequest,
  delta: { used?: number; pending?: number },
): LeaveBalance[] {
  const year = Number(r.starts_on.slice(0, 4))
  return balances.map((b) =>
    b.employee_id === r.employee_id && b.leave_type_id === r.leave_type_id && b.year === year
      ? { ...b, used: Math.max(0, b.used + (delta.used ?? 0)), pending: Math.max(0, b.pending + (delta.pending ?? 0)) }
      : b,
  )
}

export const useLeaveStore = create<LeaveState>((set, get) => {
  const people = () => usePeopleStore.getState()

  const patchRequest = (id: Id, status: LeaveRequest['status'], approval: LeaveApproval | null, balances: LeaveBalance[]) =>
    set((s) => ({
      requests: s.requests.map((r) => (r.id === id ? { ...r, status } : r)),
      approvals: approval ? [...s.approvals, approval] : s.approvals,
      balances,
    }))

  const decision = (
    request: LeaveRequest,
    stage: 'lead' | 'hr',
    deciderId: Id,
    verdict: 'approved' | 'rejected',
    note?: string,
  ): LeaveApproval => ({
    id: `la-${request.id}-${stage}`,
    leave_request_id: request.id,
    stage,
    decided_by: deciderId,
    decision: verdict,
    note: note?.trim() || null,
    decided_at: new Date().toISOString(),
  })

  return {
    leaveTypes: seed.leaveTypes.map((t) => ({ ...t })),
    balances: seed.leaveBalances.map((b) => ({ ...b })),
    requests: seed.leaveRequests.map((r) => ({ ...r })),
    approvals: seed.leaveApprovals.map((a) => ({ ...a })),

    daysFor: (startsOn, endsOn, halfDay) => seed.computeLeaveDays(startsOn, endsOn, halfDay, holidayProvider()),

    submitLeave: (employeeId, typeId, startsOn, endsOn, halfDay, reason, attachmentName) => {
      const s = get()
      const type = s.leaveTypes.find((t) => t.id === typeId)
      if (!type) return fail('Choose a leave type')
      if (!startsOn || !endsOn) return fail('Choose the dates')
      if (endsOn < startsOn) return fail('End date is before the start date')
      if (!reason.trim()) return fail('Add a reason')
      if (halfDay !== 'none') {
        if (!type.allows_half_day) return fail(`${type.name} leave cannot be taken as a half day`)
        if (startsOn !== endsOn) return fail('A half day needs a single date')
      }
      const days = s.daysFor(startsOn, endsOn, halfDay)
      if (days <= 0) return fail('The selected dates are all weekends or holidays')
      const clash = s.requests.find(
        (r) => r.employee_id === employeeId && (ACTIVE as readonly string[]).includes(r.status) && overlaps(r, startsOn, endsOn),
      )
      if (clash) return fail('You already have leave on some of these dates')
      const year = Number(startsOn.slice(0, 4))
      const bal = s.balancesFor(employeeId, year).find((b) => b.leave_type_id === typeId)
      if (bal && !bal.unlimited && days > bal.available) {
        return fail(`Only ${bal.available} ${bal.available === 1 ? 'day' : 'days'} of ${type.name.toLowerCase()} leave available`)
      }
      const hasLead = !!people().leadOf(employeeId)
      const request: LeaveRequest = {
        id: `lr-${String(s.requests.length + 1).padStart(3, '0')}`,
        employee_id: employeeId,
        leave_type_id: typeId,
        starts_on: startsOn,
        ends_on: endsOn,
        half_day: halfDay,
        days,
        reason: reason.trim(),
        attachment_path: attachmentName?.trim() ? `/mock/uploads/${attachmentName.trim()}` : null,
        status: hasLead ? 'pending_lead' : 'pending_hr',
        created_at: new Date().toISOString(),
      }
      const exists = s.balances.some((b) => b.employee_id === employeeId && b.leave_type_id === typeId && b.year === year)
      const base = exists
        ? s.balances
        : [...s.balances, { id: `lb-${employeeId}-${typeId}-${year}`, employee_id: employeeId, leave_type_id: typeId, year, entitled: type.annual_quota, used: 0, pending: 0 }]
      set({ requests: [request, ...s.requests], balances: adjust(base, request, { pending: days }) })
      return { ok: true, value: request }
    },

    approveAsLead: (id, deciderId, note) => {
      const s = get()
      const r = s.requests.find((x) => x.id === id)
      if (!r) return fail('Request not found')
      if (r.status !== 'pending_lead') return fail('This request is not waiting for a lead')
      if (r.employee_id === deciderId) return fail('You cannot approve your own request')
      patchRequest(id, 'pending_hr', decision(r, 'lead', deciderId, 'approved', note), s.balances)
      return { ok: true, value: { ...r, status: 'pending_hr' } }
    },

    approveAsHr: (id, deciderId, note) => {
      const s = get()
      const r = s.requests.find((x) => x.id === id)
      if (!r) return fail('Request not found')
      if (r.status !== 'pending_hr') return fail('This request is not waiting for HR')
      if (r.employee_id === deciderId) return fail('You cannot approve your own request')
      patchRequest(id, 'approved', decision(r, 'hr', deciderId, 'approved', note), adjust(s.balances, r, { pending: -r.days, used: r.days }))
      return { ok: true, value: { ...r, status: 'approved' } }
    },

    reject: (id, stage, deciderId, note) => {
      const s = get()
      const r = s.requests.find((x) => x.id === id)
      if (!r) return fail('Request not found')
      if (r.status !== (stage === 'lead' ? 'pending_lead' : 'pending_hr')) return fail('This request is not at that stage')
      if (!note.trim()) return fail('Add a reason for rejecting')
      patchRequest(id, 'rejected', decision(r, stage, deciderId, 'rejected', note), adjust(s.balances, r, { pending: -r.days }))
      return { ok: true, value: { ...r, status: 'rejected' } }
    },

    cancel: (id) => {
      const s = get()
      const r = s.requests.find((x) => x.id === id)
      if (!r) return fail('Request not found')
      if (r.status === 'pending_lead' || r.status === 'pending_hr') {
        patchRequest(id, 'cancelled', null, adjust(s.balances, r, { pending: -r.days }))
      } else if (r.status === 'approved' && r.starts_on > todayIso()) {
        patchRequest(id, 'cancelled', null, adjust(s.balances, r, { used: -r.days }))
      } else {
        return fail('This request can no longer be cancelled')
      }
      return { ok: true, value: { ...r, status: 'cancelled' } }
    },

    updateLeaveType: (id, patch) =>
      set((s) => ({ leaveTypes: s.leaveTypes.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

    balancesFor: (employeeId, year) => {
      const s = get()
      return s.leaveTypes
        .map((type): BalanceView | null => {
          const row = s.balances.find((b) => b.employee_id === employeeId && b.leave_type_id === type.id && b.year === year)
          const base: LeaveBalance = row ?? { id: `lb-${employeeId}-${type.id}-${year}`, employee_id: employeeId, leave_type_id: type.id, year, entitled: type.annual_quota, used: 0, pending: 0 }
          const main = ['lt-casual', 'lt-sick', 'lt-annual', 'lt-unpaid'].includes(type.id)
          if (!row && !main) return null
          const unlimited = isUnlimited(type)
          return { ...base, type, unlimited, available: unlimited ? Infinity : Math.max(0, base.entitled - base.used - base.pending) }
        })
        .filter((b): b is BalanceView => b !== null)
    },

    requestsFor: (employeeId) =>
      get()
        .requests.filter((r) => r.employee_id === employeeId)
        .sort((a, b) => b.starts_on.localeCompare(a.starts_on)),

    pendingFor: ({ employeeId, role }) => {
      const s = get()
      if (role === 'team_lead') {
        const ids = new Set(people().membersOfLead(employeeId).map((e) => e.id))
        return s.requests.filter((r) => r.status === 'pending_lead' && ids.has(r.employee_id))
      }
      if (role === 'hr' || role === 'management') {
        return s.requests.filter((r) => r.status === 'pending_hr' && r.employee_id !== employeeId)
      }
      return []
    },

    overlapsFor: (request) => {
      const team = people().teamOf(request.employee_id)
      if (!team) return []
      const mates = new Set(people().employees.filter((e) => e.team_id === team.id).map((e) => e.id))
      return get().requests.filter(
        (r) =>
          r.id !== request.id &&
          r.employee_id !== request.employee_id &&
          mates.has(r.employee_id) &&
          (ACTIVE as readonly string[]).includes(r.status) &&
          overlaps(r, request.starts_on, request.ends_on),
      )
    },

    approvalsFor: (requestId) =>
      get()
        .approvals.filter((a) => a.leave_request_id === requestId)
        .sort((a, b) => a.decided_at.localeCompare(b.decided_at)),

    balanceAfter: (request) => {
      const s = get()
      const type = s.leaveTypes.find((t) => t.id === request.leave_type_id)
      if (!type || isUnlimited(type)) return null
      const bal = s.balancesFor(request.employee_id, Number(request.starts_on.slice(0, 4))).find((b) => b.leave_type_id === type.id)
      // Pending days are already reserved, so approving does not change what is available.
      return bal ? bal.available : 0
    },

    approvedOn: (date) => get().requests.filter((r) => r.status === 'approved' && r.starts_on <= date && r.ends_on >= date),
  }
})

persistStore(useLeaveStore, 'leave', ['leaveTypes', 'balances', 'requests', 'approvals'])

navBadges.set('leave-approvals', () => {
  const employee = useSession((s) => s.employee)
  const role = useSession((s) => s.role)
  usePeopleStore((s) => s.employees)
  return useLeaveStore((s) => (employee && role ? s.pendingFor({ employeeId: employee.id, role }).length : 0))
})
