import { Link, router, useForm } from '@inertiajs/react'
import { Ban, CreditCard, Pencil, Printer, Send } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { HistoryPanel } from '../../components/shared/HistoryPanel'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Button, Card, CardBody, CardHeader, Dialog, Field, Input, NativeSelect, toast } from '../../components/ui'
import { useShared } from '../../inertia/props'
import type { Invoice } from '../../types'
import { balanceOf, errorText, invoiceLabel, isoToday, paymentMethods } from './helpers'
import { InvoiceSheet, type InvoiceDetailProps } from './InvoiceSheet'

function PaymentDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const form = useForm({
    paid_on: isoToday(),
    amount: String(balanceOf(invoice)),
    method: paymentMethods[0],
    reference: '',
  })
  const { data } = form
  const set = <K extends keyof typeof data>(key: K, value: (typeof data)[K]) => {
    form.clearErrors()
    form.setData((d) => ({ ...d, [key]: value }))
  }
  const error = errorText(form.errors as Record<string, string>)

  const save = () => {
    form.transform((d) => ({ ...d, amount: Number(d.amount) }))
    form.post(route('billing.invoices.payments.store', invoice.id), {
      preserveScroll: true,
      onSuccess: onClose,
    })
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Record payment"
      description={`${invoiceLabel(invoice)}. Balance due is ${balanceOf(invoice).toLocaleString('en-US')} ${invoice.currency}.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!(Number(data.amount) > 0) || !data.paid_on || form.processing}>
            Record payment
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <Field label="Paid on" required>
          <Input type="date" value={data.paid_on} onChange={(e) => set('paid_on', e.target.value)} />
        </Field>
        <Field label={`Amount (${invoice.currency})`} required error={error}>
          <Input type="number" min={0} step="any" value={data.amount} onChange={(e) => set('amount', e.target.value)} />
        </Field>
        <Field label="Method">
          <NativeSelect value={data.method} onChange={(e) => set('method', e.target.value)}>
            {paymentMethods.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Reference">
          <Input value={data.reference} onChange={(e) => set('reference', e.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}

const printCss = `@page { size: A4; margin: 12mm; }
@media print { .invoice-print { border: 0; box-shadow: none; } }`

export default function InvoiceDetailPage() {
  const { invoice, client, project, lines, payments, audit } = useShared<InvoiceDetailProps>()
  const [paying, setPaying] = useState(false)
  const [voiding, setVoiding] = useState(false)

  const label = invoiceLabel(invoice)
  const history = audit.map((a) => ({
    at: a.at,
    actor: a.actor,
    text: a.text,
  }))
  const canPay = invoice.status === 'sent' || invoice.status === 'overdue'
  const canVoid = invoice.status !== 'void' && invoice.status !== 'paid' && invoice.paid_total === 0
  const act = (name: string, onDone?: () => void) =>
    router.post(
      route(name, invoice.id),
      {},
      {
        preserveScroll: true,
        onSuccess: onDone,
        onError: (e) => toast.error(errorText(e)),
      },
    )

  return (
    <div className="mx-auto max-w-content">
      <style>{printCss}</style>
      <PageHeader
        title={label}
        breadcrumb={[{ label: 'Invoices', to: '/invoices' }, { label }]}
        actions={<StatusBadge status={invoice.status} />}
        className="print:hidden"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_16rem]">
        <InvoiceSheet invoice={invoice} client={client} project={project} lines={lines} payments={payments} />

        <div className="flex flex-col gap-4 print:hidden">
          <Card>
            <CardHeader title="Actions" />
            <CardBody className="flex flex-col gap-2">
              {invoice.status === 'draft' && (
                <>
                  <Button variant="primary" icon={<Send size={14} />} onClick={() => act('billing.invoices.send')}>
                    Send to client
                  </Button>
                  <Button icon={<Pencil size={14} />} onClick={() => router.get(route('billing.invoices.edit', invoice.id))}>
                    Edit draft
                  </Button>
                </>
              )}
              {canPay && (
                <Button variant="primary" icon={<CreditCard size={14} />} onClick={() => setPaying(true)}>
                  Record payment
                </Button>
              )}
              <Button icon={<Printer size={14} />} onClick={() => router.get(route('billing.invoices.print', invoice.id))}>
                Print
              </Button>
              {canVoid && (
                <Button variant="ghost" icon={<Ban size={14} />} className="text-danger" onClick={() => setVoiding(true)}>
                  Void invoice
                </Button>
              )}
              <Link href={route('billing.clients')} className="mt-1 text-sm text-fg-muted hover:text-fg hover:underline">
                View clients
              </Link>
            </CardBody>
          </Card>
          <HistoryPanel entries={history} />
        </div>
      </div>

      {paying && <PaymentDialog invoice={invoice} onClose={() => setPaying(false)} />}
      <ConfirmDialog
        open={voiding}
        onOpenChange={setVoiding}
        title="Void this invoice?"
        description={`${label} will be marked void and can no longer be sent or paid.`}
        confirmLabel="Void invoice"
        destructive
        onConfirm={() => act('billing.invoices.void', () => setVoiding(false))}
      />
    </div>
  )
}
