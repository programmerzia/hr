import { Ban, CreditCard, Pencil, Printer, Send } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { HistoryPanel } from '../../components/shared/HistoryPanel'
import { MoneyCell } from '../../components/shared/MoneyCell'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Button, Card, CardBody, CardHeader, Dialog, Field, Input, NativeSelect, Table, Tbody, Td, Th, Thead, Tr, toast } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { useBilling } from '../../mock/stores/billing'
import { usePeopleStore } from '../../mock/stores/people'
import { useWork } from '../../mock/stores/work'
import type { Invoice } from '../../types'
import { balanceOf, COMPANY, isoToday, paymentMethods } from './helpers'

const printCss = `@page { size: A4; margin: 12mm; }
@media print { .invoice-print { border: 0; box-shadow: none; } }`

function PaymentDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const recordPayment = useBilling((s) => s.recordPayment)
  const [paidOn, setPaidOn] = useState(isoToday())
  const [amount, setAmount] = useState(String(balanceOf(invoice)))
  const [method, setMethod] = useState(paymentMethods[0])
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | undefined>()

  const save = () => {
    const res = recordPayment(invoice.id, { paidOn, amount: Number(amount), method, reference: reference || null })
    if (!res.ok) return setError(res.error)
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Record payment"
      description={`${invoice.number}. Balance due is ${balanceOf(invoice).toLocaleString('en-US')} ${invoice.currency}.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!(Number(amount) > 0) || !paidOn}>
            Record payment
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <Field label="Paid on" required>
          <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </Field>
        <Field label={`Amount (${invoice.currency})`} required error={error}>
          <Input type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Method">
          <NativeSelect value={method} onChange={(e) => setMethod(e.target.value)}>
            {paymentMethods.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Reference">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}

/** `printView` is the bare route (/invoices/:id/print): just the sheet and a print button. */
export function InvoiceDetailPage({ printView = false }: { printView?: boolean }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const b = useBilling()
  const people = usePeopleStore((s) => s.employees)
  const projects = useWork((s) => s.projects)
  const [paying, setPaying] = useState(false)
  const [voiding, setVoiding] = useState(false)

  const invoice = b.invoiceById(id)
  if (!invoice) {
    return (
      <div className="mx-auto max-w-content">
        <PageHeader title="Invoice not found" breadcrumb={[{ label: 'Invoices', to: '/invoices' }]} />
        <p className="text-sm text-fg-muted">This invoice does not exist or was removed.</p>
      </div>
    )
  }

  const client = b.clientById(invoice.client_id)
  const project = projects.find((p) => p.id === invoice.project_id)
  const lines = b.linesFor(invoice.id)
  const payments = b.paymentsFor(invoice.id)
  const balance = balanceOf(invoice)
  const taxAmount = Math.round(invoice.subtotal * invoice.tax_percent) / 100
  const history = b.auditFor('invoice', invoice.id).map((a) => ({
    at: a.at,
    actor: a.actor_id === 'system' ? 'System' : (people.find((e) => e.id === a.actor_id)?.name ?? a.actor_id),
    text: a.text,
  }))
  const canPay = invoice.status === 'sent' || invoice.status === 'overdue'
  const canVoid = invoice.status !== 'void' && invoice.status !== 'paid' && invoice.paid_total === 0

  return (
    <div className="mx-auto max-w-content">
      <style>{printCss}</style>
      {printView ? (
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link to={`/invoices/${invoice.id}`} className="text-sm text-accent hover:underline">
            Back to invoice
          </Link>
          <Button variant="primary" icon={<Printer size={14} />} onClick={() => window.print()}>
            Print or save as PDF
          </Button>
        </div>
      ) : (
        <PageHeader
          title={invoice.number}
          breadcrumb={[{ label: 'Invoices', to: '/invoices' }, { label: invoice.number }]}
          actions={<StatusBadge status={invoice.status} />}
          className="print:hidden"
        />
      )}

      <div className={printView ? 'grid grid-cols-1' : 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_16rem]'}>
        <Card className="invoice-print p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold">{COMPANY.name}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-fg-muted">{COMPANY.address}</p>
              <p className="text-sm text-fg-muted">{COMPANY.email}</p>
            </div>
            <div className="text-right">
              {printView ? <h1 className="text-xl font-semibold">Invoice</h1> : <p className="text-xl font-semibold">Invoice</p>}
              <p className="font-mono text-sm">{invoice.number}</p>
              <div className="mt-1">
                <StatusBadge status={invoice.status} />
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-fg-muted">Bill to</p>
              <p className="mt-1 font-medium">{client?.name}</p>
              <p className="whitespace-pre-line text-sm text-fg-muted">{client?.address}</p>
              <p className="text-sm text-fg-muted">{client?.email}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:justify-self-end">
              <dt className="text-fg-muted">Issued</dt>
              <dd>{formatDate(invoice.issued_on)}</dd>
              <dt className="text-fg-muted">Due</dt>
              <dd className={invoice.status === 'overdue' ? 'text-danger' : undefined}>{formatDate(invoice.due_on)}</dd>
              <dt className="text-fg-muted">Project</dt>
              <dd>{project?.name ?? 'Retainer'}</dd>
              <dt className="text-fg-muted">Currency</dt>
              <dd>{invoice.currency}</dd>
            </dl>
          </div>

          <div className="mt-6">
            <Table>
              <Thead>
                <tr>
                  <Th>Description</Th>
                  <Th numeric>Qty</Th>
                  <Th numeric>Unit price</Th>
                  <Th numeric>Amount</Th>
                </tr>
              </Thead>
              <Tbody>
                {lines.map((l) => (
                  <Tr key={l.id}>
                    <Td>{l.description}</Td>
                    <Td numeric>{l.qty}</Td>
                    <Td>
                      <MoneyCell amount={l.unit_price} currency={invoice.currency} />
                    </Td>
                    <Td>
                      <MoneyCell amount={l.amount} currency={invoice.currency} />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>

          <dl className="ml-auto mt-4 flex w-full max-w-xs flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-fg-muted">Subtotal</dt>
              <dd>
                <MoneyCell amount={invoice.subtotal} currency={invoice.currency} />
              </dd>
            </div>
            {invoice.tax_percent > 0 && (
              <div className="flex justify-between">
                <dt className="text-fg-muted">Tax ({invoice.tax_percent}%)</dt>
                <dd>
                  <MoneyCell amount={taxAmount} currency={invoice.currency} />
                </dd>
              </div>
            )}
            {invoice.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-fg-muted">Discount</dt>
                <dd>
                  <MoneyCell amount={-invoice.discount} currency={invoice.currency} />
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>
                <MoneyCell amount={invoice.total} currency={invoice.currency} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-fg-muted">Paid</dt>
              <dd>
                <MoneyCell amount={invoice.paid_total} currency={invoice.currency} />
              </dd>
            </div>
            <div className="flex justify-between font-medium">
              <dt>Balance due</dt>
              <dd>
                <MoneyCell amount={balance} currency={invoice.currency} />
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            <h2 className="mb-2 text-base font-semibold">Payments</h2>
            {payments.length === 0 ? (
              <p className="text-sm text-fg-muted">No payments recorded.</p>
            ) : (
              <Table>
                <Thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Method</Th>
                    <Th>Reference</Th>
                    <Th numeric>Amount</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {payments.map((p) => (
                    <Tr key={p.id}>
                      <Td>{formatDate(p.paid_on)}</Td>
                      <Td>{p.method}</Td>
                      <Td className="font-mono text-fg-muted">{p.reference ?? '-'}</Td>
                      <Td>
                        <MoneyCell amount={p.amount} currency={invoice.currency} />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </div>

          {invoice.notes && (
            <div className="mt-6">
              <h2 className="mb-1 text-base font-semibold">Notes</h2>
              <p className="whitespace-pre-line text-sm text-fg-muted">{invoice.notes}</p>
            </div>
          )}
        </Card>

        {!printView && <div className="flex flex-col gap-4 print:hidden">
          <Card>
            <CardHeader title="Actions" />
            <CardBody className="flex flex-col gap-2">
              {invoice.status === 'draft' && (
                <>
                  <Button variant="primary" icon={<Send size={14} />} onClick={() => {
                    const res = b.sendInvoice(invoice.id)
                    if (!res.ok) toast.error(res.error)
                  }}>
                    Send to client
                  </Button>
                  <Button icon={<Pencil size={14} />} onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                    Edit draft
                  </Button>
                </>
              )}
              {canPay && (
                <Button variant="primary" icon={<CreditCard size={14} />} onClick={() => setPaying(true)}>
                  Record payment
                </Button>
              )}
              <Button icon={<Printer size={14} />} onClick={() => navigate(`/invoices/${invoice.id}/print`)}>
                Print
              </Button>
              {canVoid && (
                <Button variant="ghost" icon={<Ban size={14} />} className="text-danger" onClick={() => setVoiding(true)}>
                  Void invoice
                </Button>
              )}
              {client && (
                <Link to="/clients" className="mt-1 text-sm text-fg-muted hover:text-fg hover:underline">
                  View clients
                </Link>
              )}
            </CardBody>
          </Card>
          <HistoryPanel entries={history} />
        </div>}
      </div>

      {paying && <PaymentDialog invoice={invoice} onClose={() => setPaying(false)} />}
      <ConfirmDialog
        open={voiding}
        onOpenChange={setVoiding}
        title="Void this invoice?"
        description={`${invoice.number} will be marked void and can no longer be sent or paid.`}
        confirmLabel="Void invoice"
        destructive
        onConfirm={() => {
          const res = b.voidInvoice(invoice.id)
          if (!res.ok) toast.error(res.error)
          setVoiding(false)
        }}
      />
    </div>
  )
}
