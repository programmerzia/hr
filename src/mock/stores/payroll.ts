import { create } from 'zustand'
import type {
  Id,
  ISODate,
  PayrollAdjustment,
  PayrollAdjustmentKind,
  PayrollItem,
  PayrollRun,
  Role,
} from '../../types'
import { attendancePolicy } from '../db/attendance'
import * as seed from '../db/payroll'
import { adjustmentTotals, calcItem, eligibleEmployees, monthEnd, monthLabel, monthStart, salaryOn, workingDatesIn } from '../db/payroll'
import { useAttendance } from './attendance'
import { useLeaveStore } from './leave'
import { usePeopleStore, type Result } from './people'

export type { Result }
export { monthLabel }

export interface PayrollEvent {
  run_id: Id
  at: string
  actor_id: Id
  text: string
}

export interface RunTotals {
  employees: number
  gross: number
  adjustments: number
  deductions: number
  net: number
}

const fail = <T>(error: string): Result<T> => ({ ok: false, error })
const ok = <T>(value: T): Result<T> => ({ ok: true, value })
const p2 = (n: number) => String(n).padStart(2, '0')
const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

const isOpen = (r: PayrollRun) => r.status === 'draft' || r.status === 'review'

/** Net adjustment (bonus minus deduction) for one item. */
export const netAdjustment = (adj: PayrollAdjustment[]) => {
  const t = adjustmentTotals(adj)
  return t.bonus - t.deduction
}

interface PayrollState {
  runs: PayrollRun[]
  items: PayrollItem[]
  adjustments: PayrollAdjustment[]
  events: PayrollEvent[]

  draftRun: (year: number, month: number, byId: Id) => Result<PayrollRun>
  recompute: (runId: Id, byId: Id) => Result<PayrollRun>
  addAdjustment: (itemId: Id, kind: PayrollAdjustmentKind, label: string, amount: number, note: string, byId: Id) => Result<PayrollAdjustment>
  removeAdjustment: (adjustmentId: Id, byId: Id) => Result<true>
  submitForReview: (runId: Id, byId: Id) => Result<PayrollRun>
  approveRun: (runId: Id, byId: Id) => Result<PayrollRun>
  markPaid: (runId: Id, paidOn: ISODate, reference: string, byId: Id) => Result<PayrollRun>

  runById: (id: Id) => PayrollRun | undefined
  itemById: (id: Id) => PayrollItem | undefined
  itemsFor: (runId: Id) => PayrollItem[]
  adjustmentsFor: (itemId: Id) => PayrollAdjustment[]
  eventsFor: (runId: Id) => PayrollEvent[]
  /** Items of paid runs for this employee, newest month first. */
  payslipsFor: (employeeId: Id) => { run: PayrollRun; item: PayrollItem }[]
  totalsFor: (runId: Id) => RunTotals
}

function roleOf(employeeId: Id): Role | undefined {
  return usePeopleStore.getState().users.find((u) => u.employee_id === employeeId)?.role
}
const isHrOrMgmt = (id: Id) => {
  const r = roleOf(id)
  return r === 'hr' || r === 'management'
}

/** Days of approved leave (of paid or unpaid types) per date, for one employee within the given dates. */
function leaveWeights(employeeId: Id, dates: ISODate[], paid: boolean): Map<ISODate, number> {
  const { requests, leaveTypes } = useLeaveStore.getState()
  const out = new Map<ISODate, number>()
  for (const r of requests) {
    if (r.employee_id !== employeeId || r.status !== 'approved') continue
    const type = leaveTypes.find((t) => t.id === r.leave_type_id)
    if (!type || type.is_paid !== paid) continue
    for (const d of dates) {
      if (d < r.starts_on || d > r.ends_on) continue
      const w = r.half_day !== 'none' && r.starts_on === r.ends_on ? 0.5 : 1
      out.set(d, Math.max(out.get(d) ?? 0, w))
    }
  }
  return out
}

function factsFor(employeeId: Id, year: number, month: number) {
  const dates = workingDatesIn(year, month)
  const std = attendancePolicy.standard_minutes
  const from = monthStart(year, month)
  const to = monthEnd(year, month)
  const days = useAttendance.getState().days.filter((d) => d.employee_id === employeeId && d.date >= from && d.date <= to)
  const unpaid = leaveWeights(employeeId, dates, false)
  const paidLeave = leaveWeights(employeeId, dates, true)
  const unpaidDays = [...unpaid.values()].reduce((s, v) => s + v, 0)
  const lateCount = days.filter((d) => d.late_minutes > 0 && !d.is_regularized).length

  let worked: number
  if (days.length === 0) {
    // No attendance data at all for the month: assume full attendance except unpaid leave.
    worked = dates.length * std - unpaidDays * std
  } else {
    const today = todayKey()
    worked = days.reduce((s, d) => s + Math.round(d.work_seconds / 60), 0)
    for (const date of dates) {
      if (days.some((d) => d.date === date)) continue
      if (date > today) worked += std // projected
      else worked += (paidLeave.get(date) ?? 0) * std
    }
    // Paid leave on days that do have a record counts toward the standard only if nothing was worked.
    for (const d of days) {
      const w = paidLeave.get(d.date)
      if (w && d.work_seconds === 0) worked += w * std
    }
  }
  return { workingDays: dates.length, workedMinutes: Math.max(0, worked), unpaidDays, lateCount }
}

export const usePayroll = create<PayrollState>((set, get) => {
  const log = (run_id: Id, actor_id: Id, text: string): PayrollEvent => ({ run_id, at: new Date().toISOString(), actor_id, text })

  const buildItem = (run: PayrollRun, employeeId: Id, existing: PayrollItem | undefined, adjs: PayrollAdjustment[]): PayrollItem | null => {
    const structure = salaryOn(employeeId, monthEnd(run.year, run.month), usePeopleStore.getState().salaryStructures)
    if (!structure) return null
    const bank = usePeopleStore.getState().bankOf(employeeId)
    return {
      id: existing?.id ?? `pi-${run.year}-${p2(run.month)}-${employeeId}`,
      run_id: run.id,
      employee_id: employeeId,
      salary_structure_id: structure.id,
      ...calcItem({ structure, ...factsFor(employeeId, run.year, run.month), adjustments: adjs }),
      bank_account_id: bank?.id ?? null,
      payslip_path: null,
    }
  }

  /** Recalculates money fields of one item from its stored facts (after adjustments change). */
  const repriceItem = (item: PayrollItem, adjs: PayrollAdjustment[]): PayrollItem => {
    const structure = usePeopleStore.getState().salaryStructures.find((s) => s.id === item.salary_structure_id)
    if (!structure) return item
    return {
      ...item,
      ...calcItem({
        structure,
        workingDays: item.standard_minutes / attendancePolicy.standard_minutes,
        workedMinutes: item.worked_minutes,
        unpaidDays: item.unpaid_leave_days,
        lateCount: item.late_count,
        adjustments: adjs,
      }),
    }
  }

  const recomputeInto = (run: PayrollRun, items: PayrollItem[], adjustments: PayrollAdjustment[]) => {
    const people = usePeopleStore.getState().employees
    const eligible = eligibleEmployees(run.year, run.month, people)
    const keep = new Set<Id>()
    const next: PayrollItem[] = []
    for (const e of eligible) {
      const existing = items.find((i) => i.run_id === run.id && i.employee_id === e.id)
      const adjs = existing ? adjustments.filter((a) => a.item_id === existing.id) : []
      const item = buildItem(run, e.id, existing, adjs)
      if (item) {
        next.push(item)
        keep.add(item.id)
      }
    }
    return {
      items: [...items.filter((i) => i.run_id !== run.id), ...next],
      adjustments: adjustments.filter((a) => {
        const it = items.find((i) => i.id === a.item_id)
        return !it || it.run_id !== run.id || keep.has(a.item_id)
      }),
    }
  }

  return {
    runs: seed.payrollRuns,
    items: seed.payrollItems,
    adjustments: seed.payrollAdjustments,
    events: seed.payrollEvents.map((e) => ({ ...e })),

    draftRun: (year, month, byId) => {
      if (!isHrOrMgmt(byId)) return fail('Only HR or management can start a payroll run.')
      const s = get()
      if (s.runs.some((r) => r.year === year && r.month === month)) return fail(`A run for ${monthLabel(year, month)} already exists.`)
      const run: PayrollRun = {
        id: seed.runId(year, month),
        year,
        month,
        status: 'draft',
        approved_by: null,
        approved_at: null,
        paid_at: null,
        payment_reference: null,
        locked_at: null,
      }
      const res = recomputeInto(run, s.items, s.adjustments)
      set({
        runs: [...s.runs, run],
        items: res.items,
        adjustments: res.adjustments,
        events: [...s.events, log(run.id, byId, 'started the run')],
      })
      return ok(run)
    },

    recompute: (runId, byId) => {
      if (!isHrOrMgmt(byId)) return fail('Only HR or management can recompute a run.')
      const s = get()
      const run = s.runs.find((r) => r.id === runId)
      if (!run) return fail('Run not found.')
      if (!isOpen(run)) return fail('Approved runs are locked and cannot be recomputed.')
      const res = recomputeInto(run, s.items, s.adjustments)
      set({ items: res.items, adjustments: res.adjustments, events: [...s.events, log(runId, byId, 'recomputed the run from attendance and leave')] })
      return ok(run)
    },

    addAdjustment: (itemId, kind, label, amount, note, byId) => {
      if (!isHrOrMgmt(byId)) return fail('Only HR or management can change adjustments.')
      const s = get()
      const item = s.items.find((i) => i.id === itemId)
      const run = item && s.runs.find((r) => r.id === item.run_id)
      if (!item || !run) return fail('Payroll item not found.')
      if (!isOpen(run)) return fail('This run is locked.')
      if (!label.trim()) return fail('Add a label.')
      if (!(amount > 0)) return fail('Enter an amount greater than zero.')
      const adj: PayrollAdjustment = {
        id: `padj-${Date.now().toString(36)}-${s.adjustments.length}`,
        item_id: itemId,
        kind,
        label: label.trim(),
        amount: Math.round(amount),
        note: note.trim() || null,
        created_by: byId,
      }
      const adjustments = [...s.adjustments, adj]
      const emp = usePeopleStore.getState().employeeById(item.employee_id)
      set({
        adjustments,
        items: s.items.map((i) => (i.id === itemId ? repriceItem(i, adjustments.filter((a) => a.item_id === itemId)) : i)),
        events: [...s.events, log(run.id, byId, `added ${kind} "${adj.label}" for ${emp?.name ?? 'an employee'}`)],
      })
      return ok(adj)
    },

    removeAdjustment: (adjustmentId, byId) => {
      if (!isHrOrMgmt(byId)) return fail('Only HR or management can change adjustments.')
      const s = get()
      const adj = s.adjustments.find((a) => a.id === adjustmentId)
      const item = adj && s.items.find((i) => i.id === adj.item_id)
      const run = item && s.runs.find((r) => r.id === item.run_id)
      if (!adj || !item || !run) return fail('Adjustment not found.')
      if (!isOpen(run)) return fail('This run is locked.')
      const adjustments = s.adjustments.filter((a) => a.id !== adjustmentId)
      const emp = usePeopleStore.getState().employeeById(item.employee_id)
      set({
        adjustments,
        items: s.items.map((i) => (i.id === item.id ? repriceItem(i, adjustments.filter((a) => a.item_id === item.id)) : i)),
        events: [...s.events, log(run.id, byId, `removed ${adj.kind} "${adj.label}" for ${emp?.name ?? 'an employee'}`)],
      })
      return ok(true)
    },

    submitForReview: (runId, byId) => {
      if (!isHrOrMgmt(byId)) return fail('Only HR or management can send a run for review.')
      const s = get()
      const run = s.runs.find((r) => r.id === runId)
      if (!run) return fail('Run not found.')
      if (run.status !== 'draft') return fail('Only draft runs can be sent for review.')
      if (!s.items.some((i) => i.run_id === runId)) return fail('This run has no employees.')
      const next = { ...run, status: 'review' as const }
      set({ runs: s.runs.map((r) => (r.id === runId ? next : r)), events: [...s.events, log(runId, byId, 'sent the run for review')] })
      return ok(next)
    },

    approveRun: (runId, byId) => {
      if (roleOf(byId) !== 'management') return fail('Only management can approve a payroll run.')
      const s = get()
      const run = s.runs.find((r) => r.id === runId)
      if (!run) return fail('Run not found.')
      if (run.status !== 'review') return fail('Only runs in review can be approved.')
      const at = new Date().toISOString()
      const next: PayrollRun = { ...run, status: 'approved', approved_by: byId, approved_at: at, locked_at: at }
      set({ runs: s.runs.map((r) => (r.id === runId ? next : r)), events: [...s.events, log(runId, byId, 'approved and locked the run')] })
      return ok(next)
    },

    markPaid: (runId, paidOn, reference, byId) => {
      if (!isHrOrMgmt(byId)) return fail('Only HR or management can mark a run as paid.')
      const s = get()
      const run = s.runs.find((r) => r.id === runId)
      if (!run) return fail('Run not found.')
      if (run.status !== 'approved') return fail('Only approved runs can be marked as paid.')
      if (!paidOn) return fail('Choose the disbursement date.')
      if (!reference.trim()) return fail('Enter the bank reference.')
      const next: PayrollRun = { ...run, status: 'paid', paid_at: `${paidOn}T12:00:00+06:00`, payment_reference: reference.trim() }
      const items = s.items.map((i) => {
        if (i.run_id !== runId) return i
        const code = usePeopleStore.getState().employeeById(i.employee_id)?.code ?? i.employee_id
        return { ...i, payslip_path: `/mock/payslips/${code}-${run.year}-${p2(run.month)}.pdf` }
      })
      set({ runs: s.runs.map((r) => (r.id === runId ? next : r)), items, events: [...s.events, log(runId, byId, `marked the run as paid (${next.payment_reference})`)] })
      return ok(next)
    },

    runById: (id) => get().runs.find((r) => r.id === id),
    itemById: (id) => get().items.find((i) => i.id === id),
    itemsFor: (runId) => {
      const people = usePeopleStore.getState()
      return get()
        .items.filter((i) => i.run_id === runId)
        .sort((a, b) => (people.employeeById(a.employee_id)?.name ?? '').localeCompare(people.employeeById(b.employee_id)?.name ?? ''))
    },
    adjustmentsFor: (itemId) => get().adjustments.filter((a) => a.item_id === itemId),
    eventsFor: (runId) => get().events.filter((e) => e.run_id === runId).sort((a, b) => b.at.localeCompare(a.at)),
    payslipsFor: (employeeId) => {
      const s = get()
      return s.items
        .filter((i) => i.employee_id === employeeId)
        .flatMap((item) => {
          const run = s.runs.find((r) => r.id === item.run_id)
          return run && run.status === 'paid' ? [{ run, item }] : []
        })
        .sort((a, b) => b.run.year * 100 + b.run.month - (a.run.year * 100 + a.run.month))
    },
    totalsFor: (runId) => {
      const s = get()
      const items = s.items.filter((i) => i.run_id === runId)
      const ids = new Set(items.map((i) => i.id))
      const adj = adjustmentTotals(s.adjustments.filter((a) => ids.has(a.item_id)))
      return {
        employees: items.length,
        gross: items.reduce((t, i) => t + i.gross, 0),
        adjustments: adj.bonus,
        deductions: items.reduce((t, i) => t + i.unpaid_deduction + i.late_deduction + i.tax + i.pf, 0) + adj.deduction,
        net: items.reduce((t, i) => t + i.net, 0),
      }
    },
  }
})

// The current-month draft is seeded with placeholder facts; sync it with real attendance and leave once.
{
  const s = usePayroll.getState()
  for (const run of s.runs) if (run.status === 'draft') usePayroll.setState((st) => ({ ...st, ...recomputeSeedDraft(run, st) }))
}

function recomputeSeedDraft(run: PayrollRun, st: PayrollState) {
  // Mirrors recompute() without logging an event.
  const people = usePeopleStore.getState().employees
  const items: PayrollItem[] = []
  for (const e of eligibleEmployees(run.year, run.month, people)) {
    const existing = st.items.find((i) => i.run_id === run.id && i.employee_id === e.id)
    if (!existing) continue
    const structure = usePeopleStore.getState().salaryStructures.find((x) => x.id === existing.salary_structure_id)
    if (!structure) continue
    const adjs = st.adjustments.filter((a) => a.item_id === existing.id)
    items.push({ ...existing, ...calcItem({ structure, ...factsFor(e.id, run.year, run.month), adjustments: adjs }) })
  }
  return { items: [...st.items.filter((i) => i.run_id !== run.id), ...items] }
}
