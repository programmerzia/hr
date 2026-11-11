import { MoneyCell } from '../../components/shared/MoneyCell'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Card, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { formatDate } from '../../lib/format'
import type { Client, Invoice, InvoiceLine, InvoicePayment } from '../../types'
import { balanceOf, COMPANY, invoiceLabel } from './helpers'

export interface InvoiceDetailProps {
  invoice: Invoice
  client: Client
  project: { id: string; name: string } | null
  lines: InvoiceLine[]
  payments: InvoicePayment[]
  audit: {
    id: string
    at: string
    actor_id: string | null
    actor: string
    text: string
  }[]
}

/** The printable invoice sheet, shared by the detail page and the bare print route. */
export function InvoiceSheet({
  invoice,
  client,
  project,
  lines,
  payments,
  asHeading = false,
}: Omit<InvoiceDetailProps, 'audit'> & { asHeading?: boolean }) {
  const balance = balanceOf(invoice)
  const taxAmount = Math.round((invoice.subtotal * invoice.tax_percent) / 100)
  return (
    <Card className="invoice-print p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold">{COMPANY.name}</p>
          <p className="mt-1 whitespace-pre-line text-sm text-fg-muted">{COMPANY.address}</p>
          <p className="text-sm text-fg-muted">{COMPANY.email}</p>
        </div>
        <div className="text-right">
          {asHeading ? <h1 className="text-xl font-semibold">Invoice</h1> : <p className="text-xl font-semibold">Invoice</p>}
          <p className="font-mono text-sm">{invoiceLabel(invoice)}</p>
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
  )
}
