import { differenceInCalendarDays, parseISO } from 'date-fns'
import { useMemo } from 'react'
import type { StackSegment } from '../../components/charts/StackedBar'
import { formatMoney } from '../../lib/format'
import { useBilling } from '../../mock/stores/billing'
import type { Currency } from '../../types'

export interface AgingRow {
  currency: Currency
  total: number
  segments: StackSegment[]
}

/** Outstanding invoice amounts by age past the due date. One row per currency, since the seed mixes BDT and USD. */
export function useInvoiceAging(): AgingRow[] {
  const invoices = useBilling((s) => s.invoices)
  return useMemo(() => {
    const today = new Date()
    const rows = new Map<Currency, number[]>()
    for (const i of invoices ?? []) {
      if (i.status !== 'sent' && i.status !== 'overdue') continue
      const late = differenceInCalendarDays(today, parseISO(i.due_on))
      const bucket = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : 3
      const arr = rows.get(i.currency) ?? [0, 0, 0, 0]
      arr[bucket] = (arr[bucket] ?? 0) + (i.total - i.paid_total)
      rows.set(i.currency, arr)
    }
    const labels: [string, StackSegment['color']][] = [
      ['Current', 'chart-6'],
      ['1-30 days late', 'chart-4'],
      ['31-60 days late', 'chart-8'],
      ['Over 60 days late', 'chart-5'],
    ]
    return [...rows].map(([currency, arr]) => ({
      currency,
      total: arr.reduce((a, b) => a + b, 0),
      segments: labels.map(([label, color], i) => ({ label, color, value: arr[i] ?? 0, display: formatMoney(arr[i] ?? 0, currency) })),
    }))
  }, [invoices])
}
