import type { BarDatum } from '../../components/charts/Bars'
import type { StackSegment } from '../../components/charts/StackedBar'
import { formatMoney } from '../../lib/format'
import type { PayrollRun } from '../../types'
import type { RunTotals } from './helpers'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Gross per month over the most recent runs, oldest first. */
export function payrollSeries(runs: (PayrollRun & { totals: RunTotals })[], limit = 6) {
  const sorted = [...runs].sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month)).slice(-limit)
  const data: BarDatum[] = sorted.map((r, i) => ({
    label: MONTHS[r.month - 1] ?? String(r.month),
    values: [r.totals.gross],
    active: i === sorted.length - 1 ? true : undefined,
  }))
  const latest = sorted[sorted.length - 1]
  return { data, latest, latestGross: latest?.totals.gross ?? 0 }
}

/** Deductions in one run split into tax, provident fund, unpaid leave, late and manual deductions. */
export function deductionMix(mix: { label: string; value: number; color: string }[]): StackSegment[] {
  return mix.map((s) => ({ ...s, display: formatMoney(s.value) })) as StackSegment[]
}
