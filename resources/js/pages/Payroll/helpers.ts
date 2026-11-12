import { router } from '@inertiajs/react'
import { addMonths, endOfMonth, format } from 'date-fns'
import { toast } from '../../components/ui'
import type { PayrollAdjustment, PayrollItem, PayrollRun } from '../../types'

export const monthLabel = (y: number, m: number) => format(new Date(y, m - 1, 1), 'MMMM yyyy')
export const monthStart = (y: number, m: number) => format(new Date(y, m - 1, 1), 'yyyy-MM-dd')
export const monthEnd = (y: number, m: number) => format(endOfMonth(new Date(y, m - 1, 1)), 'yyyy-MM-dd')
export const nextMonth = (y: number, m: number) => {
  const d = addMonths(new Date(y, m - 1, 1), 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}
export const todayIso = () => format(new Date(), 'yyyy-MM-dd')

export interface RunTotals {
  employees: number
  gross: number
  adjustments: number
  deductions: number
  net: number
  pf_employer?: number
  held?: number
}

export interface PersonRef {
  id: string
  name: string
  code?: string
  designation?: string
  department_id?: string | null
  joined_on?: string | null
}

export interface HistoryEvent {
  id: string
  actor_id: string | null
  description: string
  created_at: string
}

export type { PayrollAdjustment, PayrollItem, PayrollRun }

/** The first failure message of a rejected payroll request (domain errors arrive under `payroll`). */
export const failureOf = (errors: Record<string, string>) => errors.payroll ?? Object.values(errors)[0] ?? 'Something went wrong'

/** POST a payroll action; failures toast the domain message. */
export function act(url: string, data: Record<string, unknown> = {}) {
  router.post(url, data as never, { preserveScroll: true, onError: (e) => toast.error(failureOf(e)) })
}

/** Net adjustment (bonus minus deduction) for one item. */
export const netAdjustment = (adj: Pick<PayrollAdjustment, 'kind' | 'amount'>[]) =>
  adj.reduce((t, a) => t + (a.kind === 'bonus' ? a.amount : -a.amount), 0)
