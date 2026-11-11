import { addDays, format, getDay, getDaysInMonth } from 'date-fns'
import type { Employee, ISODate, PayrollAdjustment, PayrollItem, PayrollRun, SalaryStructure } from '../../types'
import { attendancePolicy, isHoliday } from './attendance'
import { employees, salaryStructures } from './people'

/**
 * Payroll policy (HR-editable later).
 * Overtime pay is off by default: overtime minutes are still recorded on the item.
 */
export const payrollPolicy = {
  overtime_enabled: false,
  overtime_multiplier: 1,
}

/**
 * Eligibility: full_time employees only, who had joined by the end of the month and had not exited before it began.
 * Contractors are paid through claims. Interns are excluded: they have a stipend structure but no PF and are
 * settled outside the payroll run in this mock.
 */
export function eligibleEmployees(year: number, month: number, list: Employee[] = employees): Employee[] {
  const first = monthStart(year, month)
  const last = monthEnd(year, month)
  return list.filter(
    (e) => e.employment_type === 'full_time' && e.joined_on <= last && (e.exited_on === null || e.exited_on >= first),
  )
}

const p2 = (n: number) => String(n).padStart(2, '0')
export const monthStart = (y: number, m: number): ISODate => `${y}-${p2(m)}-01`
export const monthEnd = (y: number, m: number): ISODate => `${y}-${p2(m)}-${p2(getDaysInMonth(new Date(y, m - 1, 1)))}`
export const monthLabel = (y: number, m: number) => format(new Date(y, m - 1, 1), 'MMMM yyyy')

/** All dates (yyyy-MM-dd) in the month that are neither weekend nor holiday. */
export function workingDatesIn(year: number, month: number): ISODate[] {
  const out: ISODate[] = []
  const n = getDaysInMonth(new Date(year, month - 1, 1))
  for (let d = 1; d <= n; d++) {
    const dt = new Date(year, month - 1, d)
    const key = `${year}-${p2(month)}-${p2(d)}`
    if (attendancePolicy.weekend_days.includes(getDay(dt)) || isHoliday(key)) continue
    out.push(key)
  }
  return out
}

export function salaryOn(employeeId: string, onDate: ISODate, list: SalaryStructure[] = salaryStructures) {
  return list
    .filter((s) => s.employee_id === employeeId && s.effective_from <= onDate)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]
}

export interface CalcFacts {
  structure: SalaryStructure
  workingDays: number
  workedMinutes: number
  unpaidDays: number
  lateCount: number
  adjustments: Pick<PayrollAdjustment, 'kind' | 'amount'>[]
}

export type CalcResult = Pick<
  PayrollItem,
  | 'standard_minutes'
  | 'worked_minutes'
  | 'overtime_minutes'
  | 'unpaid_leave_days'
  | 'late_count'
  | 'gross'
  | 'overtime_pay'
  | 'unpaid_deduction'
  | 'late_deduction'
  | 'tax'
  | 'pf'
  | 'net'
>

export const adjustmentTotals = (adj: Pick<PayrollAdjustment, 'kind' | 'amount'>[]) => ({
  bonus: adj.filter((a) => a.kind === 'bonus').reduce((s, a) => s + a.amount, 0),
  deduction: adj.filter((a) => a.kind === 'deduction').reduce((s, a) => s + a.amount, 0),
})

/** Pure calculator shared by the seed and the store's recompute. */
export function calcItem(f: CalcFacts): CalcResult {
  const { structure: s } = f
  const standard = f.workingDays * attendancePolicy.standard_minutes
  const overtime = Math.max(0, f.workedMinutes - standard)
  const daily = f.workingDays > 0 ? s.gross / f.workingDays : 0
  const rule = attendancePolicy.late_penalty_rule
  const lateUnits = rule.lates_per_penalty > 0 ? Math.floor(f.lateCount / rule.lates_per_penalty) : 0
  const lateDeduction = Math.round(lateUnits * rule.penalty_days * daily)
  const unpaidDeduction = Math.round(f.unpaidDays * daily)
  const overtimePay = payrollPolicy.overtime_enabled
    ? Math.round((overtime / 60) * s.hourly_rate * payrollPolicy.overtime_multiplier)
    : 0
  const pf = Math.round((s.basic * s.pf_percent) / 100)
  const adj = adjustmentTotals(f.adjustments)
  const net = s.gross + overtimePay + adj.bonus - unpaidDeduction - lateDeduction - s.tax_monthly - pf - adj.deduction
  return {
    standard_minutes: standard,
    worked_minutes: f.workedMinutes,
    overtime_minutes: overtime,
    unpaid_leave_days: f.unpaidDays,
    late_count: f.lateCount,
    gross: s.gross,
    overtime_pay: overtimePay,
    unpaid_deduction: unpaidDeduction,
    late_deduction: lateDeduction,
    tax: s.tax_monthly,
    pf,
    net,
  }
}

// ---------- Seed ----------

export interface PayrollEventSeed {
  run_id: string
  at: string
  actor_id: string
  text: string
}

const HR = 'emp-102'
const MGMT = 'emp-101'
const PAST: [number, number][] = [
  [2026, 8],
  [2026, 9],
  [2026, 10],
]
const DRAFT: [number, number] = [2026, 11]

export const runId = (y: number, m: number) => `run-${y}-${p2(m)}`

export const payrollRuns: PayrollRun[] = []
export const payrollItems: PayrollItem[] = []
export const payrollAdjustments: PayrollAdjustment[] = []
export const payrollEvents: PayrollEventSeed[] = []

const adjPlan: Record<string, { emp: string; kind: 'bonus' | 'deduction'; label: string; amount: number; note: string | null }[]> = {
  '2026-08': [{ emp: 'emp-107', kind: 'bonus', label: 'Project delivery bonus', amount: 10000, note: 'Pulse v1 launch' }],
  '2026-09': [
    { emp: 'emp-111', kind: 'deduction', label: 'Laptop damage recovery', amount: 3000, note: 'Instalment 1 of 3' },
    { emp: 'emp-119', kind: 'bonus', label: 'Referral bonus', amount: 5000, note: null },
  ],
  '2026-10': [
    { emp: 'emp-111', kind: 'deduction', label: 'Laptop damage recovery', amount: 3000, note: 'Instalment 2 of 3' },
    { emp: 'emp-103', kind: 'bonus', label: 'Festival bonus', amount: 20000, note: 'Eid-ul-Adha carry over' },
  ],
  '2026-11': [
    { emp: 'emp-111', kind: 'deduction', label: 'Laptop damage recovery', amount: 3000, note: 'Instalment 3 of 3' },
    { emp: 'emp-116', kind: 'bonus', label: 'Design award', amount: 7500, note: 'Quarterly recognition' },
  ],
}

function seedRun([y, m]: [number, number], paid: boolean) {
  const id = runId(y, m)
  const wd = workingDatesIn(y, m).length
  const last = monthEnd(y, m)
  const approvedAt = `${format(addDays(new Date(`${last}T00:00:00`), -3), 'yyyy-MM-dd')}T16:00:00+06:00`
  const paidAt = `${last}T11:30:00+06:00`
  payrollRuns.push({
    id,
    year: y,
    month: m,
    status: paid ? 'paid' : 'draft',
    approved_by: paid ? MGMT : null,
    approved_at: paid ? approvedAt : null,
    paid_at: paid ? paidAt : null,
    payment_reference: paid ? `BEFTN-${y}${p2(m)}-001` : null,
    locked_at: paid ? approvedAt : null,
  })
  const adjs = adjPlan[`${y}-${p2(m)}`] ?? []
  eligibleEmployees(y, m).forEach((e, i) => {
    const structure = salaryOn(e.id, monthEnd(y, m))
    if (!structure) return
    const unpaid = (i * 5 + m) % 13 === 0 ? 1 : 0
    const late = (i * 3 + m) % 5
    const worked = wd * attendancePolicy.standard_minutes - unpaid * attendancePolicy.standard_minutes + (((i * 7 + m) % 5) - 2) * 90
    const itemId = `pi-${y}-${p2(m)}-${e.id}`
    const itemAdj = adjs
      .filter((a) => a.emp === e.id)
      .map<PayrollAdjustment>((a, k) => ({
        id: `padj-${y}-${p2(m)}-${e.id}-${k + 1}`,
        item_id: itemId,
        kind: a.kind,
        label: a.label,
        amount: a.amount,
        note: a.note,
        created_by: HR,
      }))
    payrollAdjustments.push(...itemAdj)
    payrollItems.push({
      id: itemId,
      run_id: id,
      employee_id: e.id,
      salary_structure_id: structure.id,
      ...calcItem({ structure, workingDays: wd, workedMinutes: worked, unpaidDays: unpaid, lateCount: late, adjustments: itemAdj }),
      bank_account_id: `bank-${e.id.replace('emp-', '')}`,
      payslip_path: paid ? `/mock/payslips/${e.code}-${y}-${p2(m)}.pdf` : null,
    })
  })
  const day = (n: number) => `${y}-${p2(m)}-${p2(n)}T10:00:00+06:00`
  if (paid) {
    payrollEvents.push(
      { run_id: id, at: day(20), actor_id: HR, text: 'started the run' },
      { run_id: id, at: day(24), actor_id: HR, text: 'sent the run for review' },
      { run_id: id, at: approvedAt, actor_id: MGMT, text: 'approved and locked the run' },
      { run_id: id, at: paidAt, actor_id: HR, text: `marked the run as paid (BEFTN-${y}${p2(m)}-001)` },
    )
  } else {
    payrollEvents.push({ run_id: id, at: '2026-11-03T10:00:00+06:00', actor_id: HR, text: 'started the run' })
  }
}

PAST.forEach((ym) => seedRun(ym, true))
seedRun(DRAFT, false)
