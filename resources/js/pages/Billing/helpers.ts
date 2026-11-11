import { format } from 'date-fns'
import { formatMoney } from '../../lib/format'
import type { Currency, Invoice } from '../../types'

export const currencyOptions: { value: Currency; label: string }[] = [
  { value: 'USD', label: 'USD' },
  { value: 'BDT', label: 'BDT' },
  { value: 'EUR', label: 'EUR' },
]

export const paymentMethods = ['Bank transfer', 'Wire transfer', 'Cheque', 'Cash', 'Card']

export const COMPANY = {
  name: 'Vivacom Ltd.',
  address: 'Level 7, Navana Tower\n45 Gulshan Avenue, Dhaka 1212, Bangladesh',
  email: 'billing@vivacom.example',
}

export const balanceOf = (i: Invoice) => Math.max(0, Math.round((i.total - i.paid_total) * 100) / 100)

/** "$9,000.00 + ৳120,000" for amounts that span currencies; "-" when empty. */
export function sumByCurrency(rows: { currency: Currency; amount: number }[]): string {
  const by = new Map<Currency, number>()
  for (const r of rows) by.set(r.currency, (by.get(r.currency) ?? 0) + r.amount)
  const parts = [...by.entries()].filter(([, v]) => v !== 0).map(([c, v]) => formatMoney(v, c))
  return parts.length ? parts.join(' + ') : '-'
}

export const monthLabel = (year: number, month: number) => format(new Date(year, month - 1, 1), 'MMMM yyyy')

export const hoursText = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export const isoToday = () => format(new Date(), 'yyyy-MM-dd')
