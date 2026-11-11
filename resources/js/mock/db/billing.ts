import type { Client, ContractorClaim, Currency, Invoice, InvoiceLine, InvoicePayment, InvoiceStatus } from '../../types'

/** Ids and names match `workClients` in work.ts so projects link to these records. */
export const clients: Client[] = [
  {
    id: 'client-northwind',
    name: 'Northwind Logistics',
    email: 'accounts@northwind-logistics.example',
    address: '1200 Harbor Way, Suite 400\nRotterdam 3011, Netherlands',
    currency: 'USD',
    default_rate: 40,
  },
  {
    id: 'client-apex',
    name: 'Apex Retail Group',
    email: 'finance@apexretail.example',
    address: 'House 14, Road 27, Gulshan 1\nDhaka 1212, Bangladesh',
    currency: 'BDT',
    default_rate: 3500,
  },
  {
    id: 'client-harbor',
    name: 'Harbor Health',
    email: 'ap@harborhealth.example',
    address: '88 Wellington Street\nToronto ON M5H 1J8, Canada',
    currency: 'USD',
    default_rate: 35,
  },
]

type LineSpec = [description: string, qty: number, unitPrice: number]
type PaySpec = [paidOn: string, amount: number, method: string, reference: string | null]

interface InvSpec {
  n: number
  client: string
  project: string | null
  issued: string
  due: string
  currency: Currency
  lines: LineSpec[]
  tax: number
  discount: number
  status: InvoiceStatus
  notes: string | null
  pays?: PaySpec[]
}

const specs: InvSpec[] = [
  { n: 31, client: 'client-northwind', project: 'prj-pulse', issued: '2026-08-01', due: '2026-08-15', currency: 'USD', lines: [['Pulse mobile app retainer, August 2026', 1, 4500]], tax: 0, discount: 0, status: 'paid', notes: 'Wire transfer to the account on file.', pays: [['2026-08-12', 4500, 'Wire transfer', 'NW-WIRE-0812']] },
  { n: 32, client: 'client-harbor', project: 'prj-erp', issued: '2026-08-03', due: '2026-08-24', currency: 'USD', lines: [['Backend development, 112 h', 112, 35], ['Warehouse module QA, 28 h', 28, 35]], tax: 0, discount: 0, status: 'paid', notes: null, pays: [['2026-08-21', 4900, 'Wire transfer', 'HH-2108']] },
  { n: 33, client: 'client-apex', project: 'prj-apex', issued: '2026-08-10', due: '2026-08-24', currency: 'BDT', lines: [['Storefront redesign, milestone 1: discovery and wireframes', 1, 450000]], tax: 5, discount: 0, status: 'paid', notes: 'Fixed-price project, milestone 1 of 3.', pays: [['2026-08-22', 472500, 'Bank transfer', 'APX-BT-3318']] },
  { n: 34, client: 'client-northwind', project: 'prj-pulse', issued: '2026-09-01', due: '2026-09-15', currency: 'USD', lines: [['Pulse mobile app retainer, September 2026', 1, 4500]], tax: 0, discount: 0, status: 'paid', notes: null, pays: [['2026-09-14', 4500, 'Wire transfer', 'NW-WIRE-0914']] },
  { n: 35, client: 'client-harbor', project: 'prj-erp', issued: '2026-09-30', due: '2026-10-21', currency: 'USD', lines: [['Backend development, 120 h', 120, 35], ['Warehouse module QA, 36 h', 36, 35], ['Staging environment hosting', 1, 180]], tax: 0, discount: 120, status: 'sent', notes: 'Discount applied for the late delivery of sprint 14.', pays: [['2026-10-19', 3000, 'Wire transfer', 'HH-2110-A']] },
  { n: 36, client: 'client-apex', project: 'prj-apex', issued: '2026-09-18', due: '2026-10-02', currency: 'BDT', lines: [['Storefront redesign, milestone 2: visual design', 1, 600000]], tax: 5, discount: 15000, status: 'sent', notes: 'Fixed-price project, milestone 2 of 3.', pays: [['2026-10-06', 300000, 'Bank transfer', 'APX-BT-3402']] },
  { n: 37, client: 'client-apex', project: null, issued: '2026-09-05', due: '2026-09-20', currency: 'BDT', lines: [['Hosting and maintenance, September 2026', 1, 85000]], tax: 5, discount: 0, status: 'sent', notes: null },
  { n: 38, client: 'client-northwind', project: 'prj-pulse', issued: '2026-10-01', due: '2026-11-02', currency: 'USD', lines: [['Pulse mobile app retainer, October 2026', 1, 4500]], tax: 0, discount: 0, status: 'sent', notes: null },
  { n: 39, client: 'client-harbor', project: 'prj-erp', issued: '2026-10-31', due: '2026-11-21', currency: 'USD', lines: [['Backend development, 104 h', 104, 35], ['Warehouse module QA, 24 h', 24, 35], ['Staging environment hosting', 1, 180]], tax: 0, discount: 0, status: 'sent', notes: null },
  { n: 40, client: 'client-harbor', project: 'prj-erp', issued: '2026-10-12', due: '2026-11-02', currency: 'USD', lines: [['Data migration, extra scope', 16, 35]], tax: 0, discount: 0, status: 'void', notes: 'Voided: scope folded into the October invoice.' },
  { n: 41, client: 'client-apex', project: 'prj-apex', issued: '2026-11-05', due: '2026-11-19', currency: 'BDT', lines: [['Storefront redesign, milestone 3: build and handover', 1, 700000]], tax: 5, discount: 0, status: 'draft', notes: 'Fixed-price project, milestone 3 of 3.' },
  { n: 42, client: 'client-northwind', project: 'prj-pulse', issued: '2026-11-10', due: '2026-12-10', currency: 'USD', lines: [['Pulse mobile app retainer, November 2026', 1, 4500]], tax: 0, discount: 0, status: 'draft', notes: null },
]

export const round2 = (n: number) => Math.round(n * 100) / 100

export function computeTotals(lines: { qty: number; unit_price: number }[], taxPercent: number, discount: number) {
  const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.unit_price, 0))
  const tax = round2((subtotal * taxPercent) / 100)
  const total = round2(subtotal + tax - discount)
  return { subtotal, tax, total }
}

export const invoices: Invoice[] = []
export const invoiceLines: InvoiceLine[] = []
export const invoicePayments: InvoicePayment[] = []

for (const s of specs) {
  const id = `inv-${s.n}`
  const lines: InvoiceLine[] = s.lines.map(([description, qty, unit_price], i) => ({
    id: `${id}-l${i + 1}`,
    invoice_id: id,
    description,
    qty,
    unit_price,
    amount: round2(qty * unit_price),
  }))
  const t = computeTotals(lines, s.tax, s.discount)
  const pays: InvoicePayment[] = (s.pays ?? []).map(([paid_on, amount, method, reference], i) => ({
    id: `${id}-p${i + 1}`,
    invoice_id: id,
    paid_on,
    amount,
    method,
    reference,
  }))
  invoices.push({
    id,
    number: `VIV-${s.issued.slice(0, 4)}-${String(s.n).padStart(4, '0')}`,
    client_id: s.client,
    project_id: s.project,
    issued_on: s.issued,
    due_on: s.due,
    currency: s.currency,
    subtotal: t.subtotal,
    tax_percent: s.tax,
    discount: s.discount,
    total: t.total,
    paid_total: round2(pays.reduce((a, p) => a + p.amount, 0)),
    status: s.status,
    notes: s.notes,
    pdf_path: null,
  })
  invoiceLines.push(...lines)
  invoicePayments.push(...pays)
}

// ---------- Contractor claims ----------
// emp-114 Nusrat (lead emp-103), emp-118 Arif (lead emp-104), emp-124 Habib (lead emp-106). Rates are BDT per hour.
const rates: Record<string, number> = { 'emp-114': 1200, 'emp-118': 1000, 'emp-124': 700 }
const leads: Record<string, string> = { 'emp-114': 'emp-103', 'emp-118': 'emp-104', 'emp-124': 'emp-106' }
const FIXED_124 = 85000

// [employee, year, month, tracked min, claimed min, status]
const claimSpecs: [string, number, number, number, number, ContractorClaim['status']][] = [
  ['emp-114', 2026, 8, 9720, 9720, 'paid'],
  ['emp-114', 2026, 9, 9480, 9540, 'paid'],
  ['emp-114', 2026, 10, 9900, 9900, 'paid'],
  ['emp-114', 2026, 11, 2460, 2460, 'submitted'],
  ['emp-118', 2026, 8, 7800, 7800, 'paid'],
  ['emp-118', 2026, 9, 8160, 8100, 'paid'],
  ['emp-118', 2026, 10, 7620, 7620, 'paid'],
  ['emp-118', 2026, 11, 2220, 2280, 'verified'],
  ['emp-124', 2026, 8, 9600, 9600, 'paid'],
  ['emp-124', 2026, 9, 9540, 9540, 'paid'],
  ['emp-124', 2026, 10, 9660, 9660, 'paid'],
  ['emp-124', 2026, 11, 2340, 2340, 'draft'],
]

export const contractorClaims: ContractorClaim[] = claimSpecs.map(([emp, year, month, tracked, claimed, status]) => {
  const fixed = emp === 'emp-124' ? FIXED_124 : null
  const rate = rates[emp]
  const idx = String(month).padStart(2, '0')
  const paid = status === 'paid'
  return {
    id: `clm-${emp.slice(4)}-${year}${idx}`,
    employee_id: emp,
    year,
    month,
    tracked_minutes: tracked,
    claimed_minutes: claimed,
    rate,
    fixed_amount: fixed,
    total: fixed ?? Math.round((claimed / 60) * rate),
    status,
    verified_by: status === 'verified' || status === 'approved' || paid ? leads[emp] : null,
    approved_by: paid ? 'emp-101' : null,
    paid_at: paid ? `${year}-${String(month + 1).padStart(2, '0')}-05T11:00:00+06:00` : null,
    bank_account_id: `bank-${emp.slice(4)}`,
    pdf_path: null,
  }
})

export interface AuditSeed {
  id: string
  entity: 'invoice' | 'claim'
  entity_id: string
  at: string
  actor_id: string
  text: string
}

/** Management actor for seeded history. */
const MGMT = 'emp-101'

export const auditSeed: AuditSeed[] = [
  ...invoices.flatMap((i): AuditSeed[] => {
    const out: AuditSeed[] = [{ id: `aud-${i.id}-c`, entity: 'invoice', entity_id: i.id, at: `${i.issued_on}T09:00:00+06:00`, actor_id: MGMT, text: 'created the invoice as a draft' }]
    if (i.status !== 'draft') out.push({ id: `aud-${i.id}-s`, entity: 'invoice', entity_id: i.id, at: `${i.issued_on}T10:00:00+06:00`, actor_id: MGMT, text: 'sent the invoice to the client' })
    for (const p of invoicePayments.filter((x) => x.invoice_id === i.id)) {
      out.push({ id: `aud-${p.id}`, entity: 'invoice', entity_id: i.id, at: `${p.paid_on}T12:00:00+06:00`, actor_id: MGMT, text: `recorded a payment of ${p.amount.toLocaleString('en-US')} ${i.currency} (${p.method})` })
    }
    if (i.status === 'void') out.push({ id: `aud-${i.id}-v`, entity: 'invoice', entity_id: i.id, at: '2026-10-30T15:00:00+06:00', actor_id: MGMT, text: 'voided the invoice' })
    return out
  }),
  ...contractorClaims.flatMap((c): AuditSeed[] => {
    const next = c.month === 12 ? `${c.year + 1}-01` : `${c.year}-${String(c.month + 1).padStart(2, '0')}`
    const out: AuditSeed[] = [{ id: `aud-${c.id}-g`, entity: 'claim', entity_id: c.id, at: `${next}-01T09:00:00+06:00`, actor_id: c.employee_id, text: 'generated the claim from tracked hours' }]
    if (c.status !== 'draft') out.push({ id: `aud-${c.id}-s`, entity: 'claim', entity_id: c.id, at: `${next}-01T10:00:00+06:00`, actor_id: c.employee_id, text: 'submitted the claim' })
    if (c.verified_by) out.push({ id: `aud-${c.id}-v`, entity: 'claim', entity_id: c.id, at: `${next}-02T10:00:00+06:00`, actor_id: c.verified_by, text: 'verified the hours' })
    if (c.approved_by) out.push({ id: `aud-${c.id}-a`, entity: 'claim', entity_id: c.id, at: `${next}-03T10:00:00+06:00`, actor_id: c.approved_by, text: 'approved the claim' })
    if (c.paid_at) out.push({ id: `aud-${c.id}-p`, entity: 'claim', entity_id: c.id, at: c.paid_at, actor_id: MGMT, text: 'marked the claim as paid' })
    // Seeded history never lies in the future (the current month's claim is still in progress).
    const now = Date.now()
    return out.map((e, i) => (new Date(e.at).getTime() > now ? { ...e, at: new Date(now - (out.length - i) * 3_600_000).toISOString() } : e))
  }),
]
