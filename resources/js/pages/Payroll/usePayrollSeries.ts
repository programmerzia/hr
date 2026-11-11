import { useMemo } from 'react'
import type { BarDatum } from '../../components/charts/Bars'
import type { StackSegment } from '../../components/charts/StackedBar'
import { formatMoney } from '../../lib/format'
import { adjustmentTotals } from '../../mock/db/payroll'
import { usePayroll } from '../../mock/stores/payroll'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Gross per month over the most recent runs, oldest first. */
export function usePayrollSeries(limit = 6) {
  const runs = usePayroll((s) => s.runs)
  const items = usePayroll((s) => s.items)
  return useMemo(() => {
    const sorted = [...runs].sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month)).slice(-limit)
    const data: BarDatum[] = sorted.map((r, i) => ({
      label: MONTHS[r.month - 1] ?? String(r.month),
      values: [items.filter((x) => x.run_id === r.id).reduce((t, x) => t + x.gross, 0)],
      active: i === sorted.length - 1 ? true : undefined,
    }))
    const latest = sorted[sorted.length - 1]
    const previous = sorted[sorted.length - 2]
    const gross = (id?: string) => (id ? items.filter((x) => x.run_id === id).reduce((t, x) => t + x.gross, 0) : 0)
    return { data, latest, previous, latestGross: gross(latest?.id), previousGross: gross(previous?.id) }
  }, [runs, items, limit])
}


/** Deductions in one run split into tax, provident fund, unpaid leave, late and manual deductions. */
export function useDeductionMix(runId: string): StackSegment[] {
  const items = usePayroll((s) => s.items)
  const adjustments = usePayroll((s) => s.adjustments)
  return useMemo(() => {
    const mine = items.filter((i) => i.run_id === runId)
    const ids = new Set(mine.map((i) => i.id))
    const sum = (f: (i: (typeof mine)[number]) => number) => mine.reduce((t, i) => t + f(i), 0)
    const manual = adjustmentTotals(adjustments.filter((a) => ids.has(a.item_id))).deduction
    return [
      { label: 'Tax', value: sum((i) => i.tax), color: 'chart-1' },
      { label: 'Provident fund', value: sum((i) => i.pf), color: 'chart-2' },
      { label: 'Unpaid leave', value: sum((i) => i.unpaid_deduction), color: 'chart-4' },
      { label: 'Late', value: sum((i) => i.late_deduction), color: 'chart-5' },
      { label: 'Adjustments', value: manual, color: 'chart-3' },
    ].map((s) => ({ ...s, display: formatMoney(s.value) })) as StackSegment[]
  }, [items, adjustments, runId])
}
