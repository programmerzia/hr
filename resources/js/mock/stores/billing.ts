import { create } from 'zustand'
import { persistStore } from '../persist'
import { navBadges } from '../../app/nav'
import { auditSeed, clients as seedClients, computeTotals, contractorClaims, invoiceLines, invoicePayments, invoices as seedInvoices, round2, type AuditSeed } from '../db/billing'
import { useSession } from '../session'
import { computeTotals as dayTotals, useAttendance } from './attendance'
import { usePeopleStore, type Result } from './people'
import type {
  Client,
  ContractorClaim,
  Currency,
  Id,
  Invoice,
  InvoiceLine,
  InvoicePayment,
  ISODate,
  Role,
} from '../../types'

export type AuditEntry = AuditSeed

export interface LineInput {
  description: string
  qty: number
  unit_price: number
}

export interface InvoiceInput {
  clientId: Id
  projectId: Id | null
  issuedOn: ISODate
  dueOn: ISODate
  currency: Currency
  lines: LineInput[]
  taxPercent: number
  discount: number
  notes: string | null
}

export type ClientInput = Pick<Client, 'name' | 'email' | 'address' | 'currency' | 'default_rate'>

export interface PaymentInput {
  paidOn: ISODate
  amount: number
  method: string
  reference: string | null
}

export interface Viewer {
  employeeId: Id
  role: Role
}

export interface WeekBucket {
  label: string
  minutes: number
  days: number
}

interface BillingState {
  clients: Client[]
  invoices: Invoice[]
  lines: InvoiceLine[]
  payments: InvoicePayment[]
  claims: ContractorClaim[]
  audit: AuditEntry[]

  createClient: (input: ClientInput) => Result<Client>
  updateClient: (id: Id, patch: Partial<ClientInput>) => Result<Client>

  createInvoice: (input: InvoiceInput) => Result<Invoice>
  updateInvoice: (id: Id, input: InvoiceInput) => Result<Invoice>
  sendInvoice: (id: Id) => Result<Invoice>
  recordPayment: (id: Id, payment: PaymentInput) => Result<InvoicePayment>
  voidInvoice: (id: Id) => Result<Invoice>
  sweepOverdue: (now?: Date) => number

  generateClaim: (employeeId: Id, year: number, month: number) => Result<ContractorClaim>
  updateClaim: (id: Id, patch: { claimed_minutes?: number; fixed_amount?: number | null }) => Result<ContractorClaim>
  submitClaim: (id: Id) => Result<ContractorClaim>
  verifyClaim: (id: Id, leadId: Id) => Result<ContractorClaim>
  approveClaim: (id: Id, byId: Id) => Result<ContractorClaim>
  payClaim: (id: Id, paidOn: ISODate, reference: string) => Result<ContractorClaim>

  // selectors
  clientById: (id: Id) => Client | undefined
  invoiceById: (id: Id) => Invoice | undefined
  invoicesOfClient: (clientId: Id) => Invoice[]
  linesFor: (invoiceId: Id) => InvoiceLine[]
  paymentsFor: (invoiceId: Id) => InvoicePayment[]
  claimById: (id: Id) => ContractorClaim | undefined
  claimsFor: (employeeId: Id) => ContractorClaim[]
  claimsVisibleTo: (viewer: Viewer) => ContractorClaim[]
  /** Claims waiting on this viewer: lead = submitted, management = submitted + verified. */
  claimsAwaiting: (viewer: Viewer) => ContractorClaim[]
  auditFor: (entity: 'invoice' | 'claim', id: Id) => AuditEntry[]
  trackedMinutes: (employeeId: Id, year: number, month: number) => number
  weeklyBreakdown: (employeeId: Id, year: number, month: number) => WeekBucket[]
}

const fail = <T>(error: string): Result<T> => ({ ok: false, error })
const ok = <T>(value: T): Result<T> => ({ ok: true, value })

const isoDay = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const monthPrefix = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`

function claimTotal(claimedMinutes: number, rate: number, fixed: number | null): number {
  return fixed ?? Math.round((claimedMinutes / 60) * rate)
}

function actorId(): Id {
  return useSession.getState().employee?.id ?? 'emp-101'
}

function sweep(invoices: Invoice[], now: Date): Invoice[] {
  const today = isoDay(now)
  return invoices.map((i) => (i.status === 'sent' && i.due_on < today ? { ...i, status: 'overdue' as const } : i))
}

let seq = 0
const nextId = (p: string) => `${p}-rt-${Date.now().toString(36)}-${++seq}`

export const useBilling = create<BillingState>((set, get) => {
  const log = (entity: 'invoice' | 'claim', entityId: Id, text: string, by?: Id) =>
    set((s) => ({
      audit: [
        ...s.audit,
        { id: nextId('aud'), entity, entity_id: entityId, at: new Date().toISOString(), actor_id: by ?? actorId(), text },
      ],
    }))

  const patchInvoice = (id: Id, patch: Partial<Invoice>) =>
    set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))
  const patchClaim = (id: Id, patch: Partial<ContractorClaim>) =>
    set((s) => ({ claims: s.claims.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))

  function validateInvoice(input: InvoiceInput): string | null {
    if (!get().clients.some((c) => c.id === input.clientId)) return 'Choose a client'
    if (!input.issuedOn || !input.dueOn) return 'Issue and due dates are required'
    if (input.dueOn < input.issuedOn) return 'Due date cannot be before the issue date'
    if (input.lines.length === 0) return 'Add at least one line'
    if (input.lines.some((l) => !l.description.trim())) return 'Every line needs a description'
    if (input.lines.some((l) => !(l.qty > 0) || l.unit_price < 0)) return 'Quantity must be above zero and price cannot be negative'
    if (input.taxPercent < 0 || input.discount < 0) return 'Tax and discount cannot be negative'
    return null
  }

  function buildLines(invoiceId: Id, inputs: LineInput[]): InvoiceLine[] {
    return inputs.map((l, i) => ({
      id: `${invoiceId}-l${i + 1}`,
      invoice_id: invoiceId,
      description: l.description.trim(),
      qty: l.qty,
      unit_price: l.unit_price,
      amount: round2(l.qty * l.unit_price),
    }))
  }

  return {
    clients: seedClients.map((c) => ({ ...c })),
    invoices: sweep(
      seedInvoices.map((i) => ({ ...i })),
      new Date(),
    ),
    lines: invoiceLines.map((l) => ({ ...l })),
    payments: invoicePayments.map((p) => ({ ...p })),
    claims: contractorClaims.map((c) => ({ ...c })),
    audit: auditSeed.map((a) => ({ ...a })),

    createClient: (input) => {
      if (!input.name.trim()) return fail('Name is required')
      if (!input.email.trim()) return fail('Email is required')
      const client: Client = { id: nextId('client'), ...input, name: input.name.trim(), email: input.email.trim() }
      set((s) => ({ clients: [...s.clients, client] }))
      return ok(client)
    },

    updateClient: (id, patch) => {
      const cur = get().clients.find((c) => c.id === id)
      if (!cur) return fail('Client not found')
      if (patch.name !== undefined && !patch.name.trim()) return fail('Name is required')
      const next = { ...cur, ...patch }
      set((s) => ({ clients: s.clients.map((c) => (c.id === id ? next : c)) }))
      return ok(next)
    },

    createInvoice: (input) => {
      const err = validateInvoice(input)
      if (err) return fail(err)
      const year = input.issuedOn.slice(0, 4)
      const used = get()
        .invoices.filter((i) => i.number.startsWith(`VIV-${year}-`))
        .map((i) => Number(i.number.slice(-4)))
      const number = `VIV-${year}-${String((used.length ? Math.max(...used) : 0) + 1).padStart(4, '0')}`
      const id = nextId('inv')
      const lines = buildLines(id, input.lines)
      const t = computeTotals(lines, input.taxPercent, input.discount)
      const invoice: Invoice = {
        id,
        number,
        client_id: input.clientId,
        project_id: input.projectId,
        issued_on: input.issuedOn,
        due_on: input.dueOn,
        currency: input.currency,
        subtotal: t.subtotal,
        tax_percent: input.taxPercent,
        discount: input.discount,
        total: t.total,
        paid_total: 0,
        status: 'draft',
        notes: input.notes?.trim() || null,
        pdf_path: null,
      }
      set((s) => ({ invoices: [...s.invoices, invoice], lines: [...s.lines, ...lines] }))
      log('invoice', id, 'created the invoice as a draft')
      return ok(invoice)
    },

    updateInvoice: (id, input) => {
      const cur = get().invoices.find((i) => i.id === id)
      if (!cur) return fail('Invoice not found')
      if (cur.status !== 'draft') return fail('Only draft invoices can be edited')
      const err = validateInvoice(input)
      if (err) return fail(err)
      const lines = buildLines(id, input.lines)
      const t = computeTotals(lines, input.taxPercent, input.discount)
      const next: Invoice = {
        ...cur,
        client_id: input.clientId,
        project_id: input.projectId,
        issued_on: input.issuedOn,
        due_on: input.dueOn,
        currency: input.currency,
        subtotal: t.subtotal,
        tax_percent: input.taxPercent,
        discount: input.discount,
        total: t.total,
        notes: input.notes?.trim() || null,
      }
      set((s) => ({
        invoices: s.invoices.map((i) => (i.id === id ? next : i)),
        lines: [...s.lines.filter((l) => l.invoice_id !== id), ...lines],
      }))
      log('invoice', id, 'edited the draft')
      return ok(next)
    },

    sendInvoice: (id) => {
      const cur = get().invoices.find((i) => i.id === id)
      if (!cur) return fail('Invoice not found')
      if (cur.status !== 'draft') return fail('Only draft invoices can be sent')
      const overdue = cur.due_on < isoDay(new Date())
      const next = { ...cur, status: overdue ? ('overdue' as const) : ('sent' as const) }
      patchInvoice(id, { status: next.status })
      log('invoice', id, 'sent the invoice to the client')
      return ok(next)
    },

    recordPayment: (id, p) => {
      const cur = get().invoices.find((i) => i.id === id)
      if (!cur) return fail('Invoice not found')
      if (cur.status === 'draft') return fail('Send the invoice before recording a payment')
      if (cur.status === 'void') return fail('This invoice is void')
      if (cur.status === 'paid') return fail('This invoice is already paid')
      if (!(p.amount > 0)) return fail('Amount must be above zero')
      const remaining = round2(cur.total - cur.paid_total)
      if (p.amount > remaining) return fail('Amount is more than the balance due')
      if (!p.paidOn) return fail('Payment date is required')
      const payment: InvoicePayment = {
        id: nextId('pay'),
        invoice_id: id,
        paid_on: p.paidOn,
        amount: p.amount,
        method: p.method.trim() || 'Bank transfer',
        reference: p.reference?.trim() || null,
      }
      const paidTotal = round2(cur.paid_total + p.amount)
      set((s) => ({ payments: [...s.payments, payment] }))
      patchInvoice(id, { paid_total: paidTotal, status: paidTotal >= cur.total ? 'paid' : cur.status })
      log('invoice', id, `recorded a payment of ${p.amount.toLocaleString('en-US')} ${cur.currency} (${payment.method})`)
      return ok(payment)
    },

    voidInvoice: (id) => {
      const cur = get().invoices.find((i) => i.id === id)
      if (!cur) return fail('Invoice not found')
      if (cur.status === 'void') return fail('Already void')
      if (cur.status === 'paid' || cur.paid_total > 0) return fail('Invoices with payments cannot be voided')
      patchInvoice(id, { status: 'void' })
      log('invoice', id, 'voided the invoice')
      return ok({ ...cur, status: 'void' as const })
    },

    sweepOverdue: (now = new Date()) => {
      const before = get().invoices
      const after = sweep(before, now)
      const changed = after.filter((i, k) => i.status !== before[k].status)
      if (changed.length === 0) return 0
      set({ invoices: after })
      changed.forEach((i) => log('invoice', i.id, 'was marked overdue', 'system'))
      return changed.length
    },

    generateClaim: (employeeId, year, month) => {
      const people = usePeopleStore.getState()
      const emp = people.employeeById(employeeId)
      if (!emp || emp.employment_type !== 'contractor') return fail('Claims are only for contractors')
      const s = get()
      const existing = s.claims.find((c) => c.employee_id === employeeId && c.year === year && c.month === month)
      if (existing && existing.status !== 'draft') return fail('This month already has a submitted claim')
      const rate = people.currentSalary(employeeId)?.hourly_rate ?? 0
      const tracked = s.trackedMinutes(employeeId, year, month)
      const lastFixed = s.claimsFor(employeeId).find((c) => c.fixed_amount !== null)?.fixed_amount ?? null
      const claim: ContractorClaim = {
        id: existing?.id ?? `clm-${employeeId.slice(4)}-${monthPrefix(year, month).replace('-', '')}`,
        employee_id: employeeId,
        year,
        month,
        tracked_minutes: tracked,
        claimed_minutes: tracked,
        rate,
        fixed_amount: lastFixed,
        total: claimTotal(tracked, rate, lastFixed),
        status: 'draft',
        verified_by: null,
        approved_by: null,
        paid_at: null,
        bank_account_id: people.bankOf(employeeId)?.id ?? null,
        pdf_path: null,
      }
      set((st) => ({ claims: existing ? st.claims.map((c) => (c.id === existing.id ? claim : c)) : [...st.claims, claim] }))
      log('claim', claim.id, 'generated the claim from tracked hours', employeeId)
      return ok(claim)
    },

    updateClaim: (id, patch) => {
      const cur = get().claims.find((c) => c.id === id)
      if (!cur) return fail('Claim not found')
      if (cur.status !== 'draft') return fail('Only draft claims can be edited')
      const claimed = patch.claimed_minutes ?? cur.claimed_minutes
      const fixed = patch.fixed_amount === undefined ? cur.fixed_amount : patch.fixed_amount
      if (claimed < 0 || (fixed !== null && fixed < 0)) return fail('Values cannot be negative')
      const next = { ...cur, claimed_minutes: claimed, fixed_amount: fixed, total: claimTotal(claimed, cur.rate, fixed) }
      patchClaim(id, next)
      log('claim', id, 'edited the draft', cur.employee_id)
      return ok(next)
    },

    submitClaim: (id) => {
      const cur = get().claims.find((c) => c.id === id)
      if (!cur) return fail('Claim not found')
      if (cur.status !== 'draft') return fail('Only draft claims can be submitted')
      if (cur.claimed_minutes <= 0 && cur.fixed_amount === null) return fail('There are no hours to claim')
      patchClaim(id, { status: 'submitted' })
      log('claim', id, 'submitted the claim', cur.employee_id)
      return ok({ ...cur, status: 'submitted' as const })
    },

    verifyClaim: (id, leadId) => {
      const cur = get().claims.find((c) => c.id === id)
      if (!cur) return fail('Claim not found')
      if (cur.status !== 'submitted') return fail('Only submitted claims can be verified')
      if (usePeopleStore.getState().leadOf(cur.employee_id)?.id !== leadId) return fail('Only the contractor’s team lead can verify')
      patchClaim(id, { status: 'verified', verified_by: leadId })
      log('claim', id, 'verified the hours', leadId)
      return ok({ ...cur, status: 'verified' as const, verified_by: leadId })
    },

    approveClaim: (id, byId) => {
      const cur = get().claims.find((c) => c.id === id)
      if (!cur) return fail('Claim not found')
      if (cur.status !== 'verified') return fail('Only verified claims can be approved')
      patchClaim(id, { status: 'approved', approved_by: byId })
      log('claim', id, 'approved the claim', byId)
      return ok({ ...cur, status: 'approved' as const, approved_by: byId })
    },

    payClaim: (id, paidOn, reference) => {
      const cur = get().claims.find((c) => c.id === id)
      if (!cur) return fail('Claim not found')
      if (cur.status !== 'approved') return fail('Only approved claims can be paid')
      if (!paidOn) return fail('Payment date is required')
      patchClaim(id, { status: 'paid', paid_at: `${paidOn}T12:00:00+06:00` })
      log('claim', id, `marked the claim as paid${reference.trim() ? ` (ref ${reference.trim()})` : ''}`)
      return ok({ ...cur, status: 'paid' as const })
    },

    clientById: (id) => get().clients.find((c) => c.id === id),
    invoiceById: (id) => get().invoices.find((i) => i.id === id),
    invoicesOfClient: (clientId) => get().invoices.filter((i) => i.client_id === clientId),
    linesFor: (invoiceId) => get().lines.filter((l) => l.invoice_id === invoiceId),
    paymentsFor: (invoiceId) => get().payments.filter((p) => p.invoice_id === invoiceId),
    claimById: (id) => get().claims.find((c) => c.id === id),
    claimsFor: (employeeId) =>
      get()
        .claims.filter((c) => c.employee_id === employeeId)
        .sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month)),

    claimsVisibleTo: ({ employeeId, role }) => {
      const people = usePeopleStore.getState()
      const sorted = [...get().claims].sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month))
      if (role === 'management') return sorted
      const own = sorted.filter((c) => c.employee_id === employeeId)
      if (role === 'team_lead') {
        const team = new Set(people.membersOfLead(employeeId).map((m) => m.id))
        return sorted.filter((c) => team.has(c.employee_id) || c.employee_id === employeeId)
      }
      return own
    },

    claimsAwaiting: ({ employeeId, role }) => {
      const visible = get().claimsVisibleTo({ employeeId, role })
      if (role === 'management') return visible.filter((c) => c.status === 'submitted' || c.status === 'verified')
      if (role === 'team_lead') return visible.filter((c) => c.status === 'submitted' && c.employee_id !== employeeId)
      return []
    },

    auditFor: (entity, id) =>
      get()
        .audit.filter((a) => a.entity === entity && a.entity_id === id)
        .sort((a, b) => b.at.localeCompare(a.at)),

    trackedMinutes: (employeeId, year, month) => {
      const prefix = monthPrefix(year, month)
      const att = useAttendance.getState()
      const today = isoDay(new Date())
      let seconds = 0
      for (const d of att.days) {
        if (d.employee_id !== employeeId || !d.date.startsWith(prefix)) continue
        seconds += d.date === today ? dayTotals(att.segmentsFor(d.id), Date.now()).workSeconds : d.work_seconds
      }
      return Math.round(seconds / 60)
    },

    weeklyBreakdown: (employeeId, year, month) => {
      const prefix = monthPrefix(year, month)
      const att = useAttendance.getState()
      const today = isoDay(new Date())
      const buckets = new Map<number, WeekBucket>()
      for (const d of att.days) {
        if (d.employee_id !== employeeId || !d.date.startsWith(prefix)) continue
        const day = Number(d.date.slice(8))
        const week = Math.ceil(day / 7)
        const secs = d.date === today ? dayTotals(att.segmentsFor(d.id), Date.now()).workSeconds : d.work_seconds
        const b = buckets.get(week) ?? { label: '', minutes: 0, days: 0 }
        b.minutes += Math.round(secs / 60)
        if (secs > 0) b.days += 1
        b.label = `Days ${(week - 1) * 7 + 1}-${Math.min(week * 7, new Date(year, month, 0).getDate())}`
        buckets.set(week, b)
      }
      return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => b)
    },
  }
})

persistStore(useBilling, 'billing', ['clients', 'invoices', 'lines', 'payments', 'claims', 'audit'])

/** Contractors see how many of their own claims are still drafts. */
navBadges.set('my-claims', () => {
  const employee = useSession((s) => s.employee)
  return useBilling((s) => (employee ? s.claims.filter((c) => c.employee_id === employee.id && c.status === 'draft').length : 0))
})

/** Nav badge: management sees submitted + verified claims, a lead sees submitted claims to verify. */
navBadges.set('claims', () => {
  const employee = useSession((s) => s.employee)
  const role = useSession((s) => s.role)
  usePeopleStore((s) => s.employees)
  return useBilling((s) => (employee && role ? s.claimsAwaiting({ employeeId: employee.id, role }).length : 0))
})
