import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import type { Currency } from '../types'

const symbols: Record<Currency, string> = { BDT: '৳', USD: '$', EUR: '€' }

function indianGroup(n: number): string {
  const s = Math.trunc(n).toString()
  if (s.length <= 3) return s
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')
  return `${rest},${last3}`
}

export function formatMoney(amount: number, currency: Currency = 'BDT'): string {
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  const symbol = symbols[currency]
  if (currency === 'BDT') {
    const whole = indianGroup(Math.floor(abs))
    const frac = Math.round((abs - Math.floor(abs)) * 100)
    return `${sign}${symbol}${whole}${frac ? `.${String(frac).padStart(2, '0')}` : ''}`
  }
  const body = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${sign}${symbol}${body}`
}

function toDate(value: string | Date): Date {
  return typeof value === 'string' ? parseISO(value) : value
}

export function formatDate(value: string | Date): string {
  return format(toDate(value), 'd MMM yyyy')
}

export function formatTime(value: string | Date): string {
  return format(toDate(value), 'HH:mm')
}

/** Seconds to "7h 42m". Under one hour: "42m". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds / 60))
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** Seconds to "07:42:13". Live clock only. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

/** "3m ago" style, for chat and activity only. */
export function relativeTime(value: string | Date, now: Date = new Date()): string {
  const d = toDate(value)
  if (Math.abs(now.getTime() - d.getTime()) < 45_000) return 'just now'
  const text = formatDistanceToNowStrict(d, { roundingMethod: 'floor' })
    .replace(/ seconds?/, 's')
    .replace(/ minutes?/, 'm')
    .replace(/ hours?/, 'h')
    .replace(/ days?/, 'd')
    .replace(/ months?/, 'mo')
    .replace(/ years?/, 'y')
  return d.getTime() > now.getTime() ? `in ${text}` : `${text} ago`
}
