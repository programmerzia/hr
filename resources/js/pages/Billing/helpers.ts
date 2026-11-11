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

export const round2 = (n: number) => Math.round(n * 100) / 100

/** Mirrors App\Domain\Billing\Services\InvoiceTotals: whole units, tax rounded once on the subtotal. */
export function computeTotals(lines: { qty: number; unit_price: number }[], taxPercent: number, discount: number) {
  const subtotal = lines.reduce((s, l) => s + Math.round(l.qty * l.unit_price), 0)
  const tax = Math.round((subtotal * taxPercent) / 100)
  return { subtotal, tax, total: subtotal + tax - discount }
}

/** Drafts have a placeholder number until they are sent. */
export const invoiceLabel = (i: { number: string }) => (i.number.startsWith('DRAFT-') ? 'Draft' : i.number)

/** First message of a failed Inertia request: the domain error (`billing`) or the first validation error. */
export const errorText = (errors: Record<string, string>) => errors.billing ?? Object.values(errors)[0]

export interface ProjectRef {
  id: string
  name: string
  client_id: string | null
}
export interface AuditRow {
  id: string
  at: string
  actor_id: string | null
  actor: string
  text: string
}
