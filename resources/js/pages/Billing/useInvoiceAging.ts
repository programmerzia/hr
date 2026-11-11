import { useMemo } from 'react'
import type { StackSegment } from '../../components/charts/StackedBar'
import { formatMoney } from '../../lib/format'
import type { Currency } from '../../types'

export interface AgingProp {
  currency: Currency
  /** Outstanding amount: current, 1-30, 31-60 and over 60 days past due. */
  buckets: number[]
}

export interface AgingRow {
  currency: Currency
  total: number
  segments: StackSegment[]
}

const labels: [string, StackSegment['color']][] = [
  ['Current', 'chart-6'],
  ['1-30 days late', 'chart-4'],
  ['31-60 days late', 'chart-8'],
  ['Over 60 days late', 'chart-5'],
]

/** Outstanding invoice amounts by age past the due date, bucketed by the server. One row per currency. */
export function useInvoiceAging(aging: AgingProp[]): AgingRow[] {
  return useMemo(
    () =>
      aging.map(({ currency, buckets }) => ({
        currency,
        total: buckets.reduce((a, b) => a + b, 0),
        segments: labels.map(([label, color], i) => ({
          label,
          color,
          value: buckets[i] ?? 0,
          display: formatMoney(buckets[i] ?? 0, currency),
        })),
      })),
    [aging],
  )
}
