import { addDays, format, getDay, parseISO } from 'date-fns'
import type { HalfDay, LeaveApproval, LeaveBalance, LeaveRequest, LeaveStatus, LeaveType } from '../../types'
import { employeeById, employees, teams } from './people'

export const SEED_YEAR = 2026

export const leaveTypes: LeaveType[] = [
  { id: 'lt-casual', name: 'Casual', annual_quota: 10, is_paid: true, carry_forward: false, allows_half_day: true },
  { id: 'lt-sick', name: 'Sick', annual_quota: 14, is_paid: true, carry_forward: false, allows_half_day: true },
  { id: 'lt-annual', name: 'Annual', annual_quota: 15, is_paid: true, carry_forward: true, allows_half_day: true },
  { id: 'lt-unpaid', name: 'Unpaid', annual_quota: 0, is_paid: false, carry_forward: false, allows_half_day: true },
  { id: 'lt-maternity', name: 'Maternity', annual_quota: 112, is_paid: true, carry_forward: false, allows_half_day: false },
  { id: 'lt-paternity', name: 'Paternity', annual_quota: 7, is_paid: true, carry_forward: false, allows_half_day: false },
]

/** Weekend in Bangladesh: Friday (5) and Saturday (6). */
export function isWeekend(date: string | Date): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date
  const dow = getDay(d)
  return dow === 5 || dow === 6
}

/** Working days in [start, end] excluding weekends and holidays. A half day counts 0.5 (single day only). */
export function computeLeaveDays(start: string, end: string, half: HalfDay, holidays: string[] = []): number {
  if (end < start) return 0
  let count = 0
  for (let d = parseISO(start); format(d, 'yyyy-MM-dd') <= end; d = addDays(d, 1)) {
    const iso = format(d, 'yyyy-MM-dd')
    if (!isWeekend(d) && !holidays.includes(iso)) count += 1
  }
  if (half !== 'none' && start === end && count === 1) return 0.5
  return count
}

type Row = {
  emp: string
  type: string
  from: string
  to?: string
  half?: HalfDay
  reason: string
  status: LeaveStatus
  /** For rejected rows: which stage rejected. */
  rejectedAt?: 'lead' | 'hr'
  note?: string
  attachment?: string
}

const rows: Row[] = [
  { emp: 'emp-107', type: 'lt-annual', from: '2026-02-15', to: '2026-02-19', reason: 'Family trip to Sylhet', status: 'approved' },
  { emp: 'emp-108', type: 'lt-sick', from: '2026-03-08', to: '2026-03-09', reason: 'Fever and cold', status: 'approved', attachment: 'medical-certificate.pdf' },
  { emp: 'emp-109', type: 'lt-casual', from: '2026-04-12', half: 'first_half', reason: 'Bank work in the morning', status: 'approved' },
  { emp: 'emp-110', type: 'lt-annual', from: '2026-05-24', to: '2026-05-28', reason: 'Visiting parents in Rajshahi', status: 'approved' },
  { emp: 'emp-111', type: 'lt-casual', from: '2026-06-02', to: '2026-06-03', reason: 'Cousin wedding', status: 'approved' },
  { emp: 'emp-112', type: 'lt-sick', from: '2026-07-13', to: '2026-07-15', reason: 'Dengue recovery', status: 'approved', attachment: 'doctor-note.pdf' },
  { emp: 'emp-115', type: 'lt-annual', from: '2026-08-09', to: '2026-08-13', reason: 'Trip to Cox\'s Bazar', status: 'approved' },
  { emp: 'emp-116', type: 'lt-casual', from: '2026-09-15', reason: 'Passport appointment', status: 'approved' },
  { emp: 'emp-119', type: 'lt-sick', from: '2026-10-04', to: '2026-10-05', reason: 'Migraine', status: 'approved' },
  { emp: 'emp-120', type: 'lt-casual', from: '2026-10-18', reason: 'Family event', status: 'approved' },
  { emp: 'emp-122', type: 'lt-annual', from: '2026-03-22', to: '2026-03-26', reason: 'Eid holidays extension', status: 'approved' },
  { emp: 'emp-123', type: 'lt-casual', from: '2026-08-23', half: 'second_half', reason: 'Child school meeting', status: 'approved' },
  { emp: 'emp-103', type: 'lt-annual', from: '2026-04-05', to: '2026-04-09', reason: 'Annual break', status: 'approved' },
  { emp: 'emp-105', type: 'lt-sick', from: '2026-06-21', reason: 'Food poisoning', status: 'approved' },
  { emp: 'emp-102', type: 'lt-casual', from: '2026-05-10', reason: 'Personal errand', status: 'approved' },
  { emp: 'emp-121', type: 'lt-unpaid', from: '2026-09-06', to: '2026-09-07', reason: 'Out of town for exam', status: 'approved' },
  { emp: 'emp-107', type: 'lt-sick', from: '2026-10-25', reason: 'Back pain', status: 'approved' },
  { emp: 'emp-111', type: 'lt-annual', from: '2026-11-15', to: '2026-11-19', reason: 'Village visit', status: 'approved' },
  { emp: 'emp-104', type: 'lt-casual', from: '2026-11-12', reason: 'House shifting', status: 'approved' },
  { emp: 'emp-107', type: 'lt-annual', from: '2026-11-22', to: '2026-11-26', reason: 'Short vacation with family', status: 'pending_lead' },
  { emp: 'emp-109', type: 'lt-casual', from: '2026-11-16', to: '2026-11-17', reason: 'Sister engagement ceremony', status: 'pending_lead' },
  { emp: 'emp-110', type: 'lt-sick', from: '2026-11-11', reason: 'Not feeling well, doctor visit', status: 'pending_lead' },
  { emp: 'emp-113', type: 'lt-casual', from: '2026-11-18', reason: 'University registration', status: 'pending_lead' },
  { emp: 'emp-115', type: 'lt-casual', from: '2026-11-23', reason: 'Visa interview', status: 'pending_lead' },
  { emp: 'emp-120', type: 'lt-annual', from: '2026-12-06', to: '2026-12-10', reason: 'Year-end trip', status: 'pending_lead' },
  { emp: 'emp-123', type: 'lt-casual', from: '2026-11-17', reason: 'Bank loan paperwork', status: 'pending_lead' },
  { emp: 'emp-108', type: 'lt-annual', from: '2026-12-13', to: '2026-12-17', reason: 'Wedding in Chattogram', status: 'pending_hr' },
  { emp: 'emp-119', type: 'lt-casual', from: '2026-11-24', to: '2026-11-25', reason: 'Family matter', status: 'pending_hr' },
  { emp: 'emp-116', type: 'lt-annual', from: '2026-12-20', to: '2026-12-24', reason: 'Winter trip', status: 'pending_hr' },
  { emp: 'emp-122', type: 'lt-sick', from: '2026-11-12', reason: 'Dental surgery', status: 'pending_hr', attachment: 'dental-advice.jpg' },
  { emp: 'emp-103', type: 'lt-annual', from: '2026-12-27', to: '2026-12-31', reason: 'Year-end break', status: 'pending_hr' },
  { emp: 'emp-112', type: 'lt-casual', from: '2026-11-05', reason: 'Personal work', status: 'rejected', rejectedAt: 'lead', note: 'Release week, please pick another date' },
  { emp: 'emp-117', type: 'lt-annual', from: '2026-10-01', to: '2026-10-02', reason: 'Trip with friends', status: 'rejected', rejectedAt: 'hr', note: 'Annual leave is not available during probation' },
  { emp: 'emp-124', type: 'lt-casual', from: '2026-10-11', reason: 'Plans changed', status: 'cancelled' },
]

const HR_DECIDER = 'emp-102'
const MGMT_DECIDER = 'emp-101'

function leadFor(employeeId: string): string | null {
  const e = employeeById(employeeId)
  if (!e?.team_id) return null
  const lead = teams.find((t) => t.id === e.team_id)?.lead_employee_id ?? null
  return lead && lead !== employeeId ? lead : null
}

export const leaveRequests: LeaveRequest[] = rows.map((r, i) => ({
  id: `lr-${String(i + 1).padStart(3, '0')}`,
  employee_id: r.emp,
  leave_type_id: r.type,
  starts_on: r.from,
  ends_on: r.to ?? r.from,
  half_day: r.half ?? 'none',
  days: computeLeaveDays(r.from, r.to ?? r.from, r.half ?? 'none'),
  reason: r.reason,
  attachment_path: r.attachment ? `/mock/uploads/${r.attachment}` : null,
  status: r.status,
  created_at: `${format(addDays(parseISO(r.from), r.from < '2026-11-10' ? -5 : -(i % 4) - 1), 'yyyy-MM-dd')}T10:${String(10 + i).padStart(2, '0')}:00+06:00`,
}))

export const leaveApprovals: LeaveApproval[] = rows.flatMap((r, i) => {
  const reqId = leaveRequests[i].id
  const created = leaveRequests[i].created_at.slice(0, 10)
  const lead = leadFor(r.emp)
  const hrDecider = r.emp === HR_DECIDER ? MGMT_DECIDER : HR_DECIDER
  const out: LeaveApproval[] = []
  const mk = (stage: 'lead' | 'hr', by: string, decision: 'approved' | 'rejected', note: string | null, dayOffset: number): LeaveApproval => ({
    id: `la-${reqId}-${stage}`,
    leave_request_id: reqId,
    stage,
    decided_by: by,
    decision,
    note,
    decided_at: `${format(addDays(parseISO(created), dayOffset), 'yyyy-MM-dd')}T15:30:00+06:00`,
  })
  if (r.status === 'cancelled' || r.status === 'pending_lead') return out
  if (r.status === 'rejected' && r.rejectedAt === 'lead' && lead) return [mk('lead', lead, 'rejected', r.note ?? null, 1)]
  if (lead) out.push(mk('lead', lead, 'approved', null, 1))
  if (r.status === 'rejected') out.push(mk('hr', hrDecider, 'rejected', r.note ?? null, 2))
  if (r.status === 'approved') out.push(mk('hr', hrDecider, 'approved', null, 2))
  return out
})

const MAIN_TYPES = ['lt-casual', 'lt-sick', 'lt-annual', 'lt-unpaid']

export const leaveBalances: LeaveBalance[] = employees.flatMap((e) => {
  const restricted = e.employment_type !== 'full_time' || e.status === 'probation'
  const typeIds = new Set(MAIN_TYPES)
  leaveRequests.filter((r) => r.employee_id === e.id).forEach((r) => typeIds.add(r.leave_type_id))
  return [...typeIds].map((typeId) => {
    const type = leaveTypes.find((t) => t.id === typeId) as LeaveType
    const mine = leaveRequests.filter((r) => r.employee_id === e.id && r.leave_type_id === typeId && r.starts_on.startsWith(String(SEED_YEAR)))
    const sum = (s: LeaveStatus[]) => mine.filter((r) => s.includes(r.status)).reduce((a, r) => a + r.days, 0)
    let entitled = type.annual_quota
    if (typeId === 'lt-annual') entitled = restricted ? 0 : type.annual_quota + (Number(e.id.slice(4)) % 3 === 0 ? 2 : 0)
    return {
      id: `lb-${e.id}-${typeId}-${SEED_YEAR}`,
      employee_id: e.id,
      leave_type_id: typeId,
      year: SEED_YEAR,
      entitled,
      used: sum(['approved']),
      pending: sum(['pending_lead', 'pending_hr']),
    }
  })
})
