import { addDays, format } from 'date-fns'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { MoneyCell } from '../../components/shared/MoneyCell'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button, Card, CardBody, CardHeader, Field, IconButton, Input, NativeSelect, Table, Tbody, Td, Textarea, Th, Thead, Tr } from '../../components/ui'
import { computeTotals } from '../../mock/db/billing'
import { useBilling } from '../../mock/stores/billing'
import { useWork } from '../../mock/stores/work'
import type { Currency } from '../../types'
import { currencyOptions, isoToday } from './helpers'

interface Row {
  key: number
  description: string
  qty: string
  price: string
}

let rowKey = 0
const blankRow = (): Row => ({ key: ++rowKey, description: '', qty: '1', price: '' })

export function InvoiceEditorPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { clients, invoiceById, linesFor, createInvoice, updateInvoice } = useBilling()
  const projects = useWork((s) => s.projects)

  const existing = id ? invoiceById(id) : undefined
  const existingLines = existing ? linesFor(existing.id) : []
  const preset = clients.find((c) => c.id === params.get('client')) ?? clients[0]

  const [clientId, setClientId] = useState(existing?.client_id ?? preset?.id ?? '')
  const [projectId, setProjectId] = useState(existing?.project_id ?? '')
  const [issuedOn, setIssuedOn] = useState(existing?.issued_on ?? isoToday())
  const [dueOn, setDueOn] = useState(existing?.due_on ?? format(addDays(new Date(), 14), 'yyyy-MM-dd'))
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? preset?.currency ?? 'USD')
  const [rows, setRows] = useState<Row[]>(
    existing
      ? existingLines.map((l) => ({ key: ++rowKey, description: l.description, qty: String(l.qty), price: String(l.unit_price) }))
      : [blankRow()],
  )
  const [tax, setTax] = useState(String(existing?.tax_percent ?? 0))
  const [discount, setDiscount] = useState(String(existing?.discount ?? 0))
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [error, setError] = useState<string | undefined>()

  if (id && !existing) {
    return <p className="p-6 text-sm text-fg-muted">This invoice does not exist.</p>
  }
  if (existing && existing.status !== 'draft') {
    return <p className="p-6 text-sm text-fg-muted">Only draft invoices can be edited.</p>
  }

  const clientProjects = projects.filter((p) => p.client_id === clientId)
  const parsed = rows.map((r) => ({ description: r.description, qty: Number(r.qty) || 0, unit_price: Number(r.price) || 0 }))
  const totals = computeTotals(parsed, Number(tax) || 0, Number(discount) || 0)

  const pickClient = (next: string) => {
    setClientId(next)
    setProjectId('')
    const c = clients.find((x) => x.id === next)
    if (c) setCurrency(c.currency)
  }

  const patchRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const save = () => {
    const input = {
      clientId,
      projectId: projectId || null,
      issuedOn,
      dueOn,
      currency,
      lines: parsed,
      taxPercent: Number(tax) || 0,
      discount: Number(discount) || 0,
      notes: notes || null,
    }
    const res = existing ? updateInvoice(existing.id, input) : createInvoice(input)
    if (!res.ok) return setError(res.error)
    navigate(`/invoices/${res.value.id}`)
  }

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title={existing ? `Edit ${existing.number}` : 'New invoice'}
        breadcrumb={[{ label: 'Invoices', to: '/invoices' }, { label: existing ? existing.number : 'New invoice' }]}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate(existing ? `/invoices/${existing.id}` : '/invoices')}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save}>
              Save draft
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Client" required>
                <NativeSelect value={clientId} onChange={(e) => pickClient(e.target.value)}>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Project" hint="Leave empty for a retainer not tied to a project.">
                <NativeSelect value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">No project</option>
                  {clientProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Issue date" required>
                <Input type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
              </Field>
              <Field label="Due date" required>
                <Input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
              </Field>
              <Field label="Currency">
                <NativeSelect value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                  {currencyOptions.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Lines"
              actions={
                <Button size="sm" icon={<Plus size={14} />} onClick={() => setRows((rs) => [...rs, blankRow()])}>
                  Add line
                </Button>
              }
            />
            <CardBody>
              <Table>
                <Thead>
                  <tr>
                    <Th>Description</Th>
                    <Th numeric className="w-24">
                      Qty
                    </Th>
                    <Th numeric className="w-32">
                      Unit price
                    </Th>
                    <Th numeric className="w-32">
                      Amount
                    </Th>
                    <Th className="w-10" />
                  </tr>
                </Thead>
                <Tbody>
                  {rows.map((r, i) => (
                    <Tr key={r.key}>
                      <Td>
                        <Input aria-label={`Line ${i + 1} description`} value={r.description} onChange={(e) => patchRow(r.key, { description: e.target.value })} />
                      </Td>
                      <Td>
                        <Input aria-label={`Line ${i + 1} quantity`} type="number" min={0} step="any" className="text-right font-mono" value={r.qty} onChange={(e) => patchRow(r.key, { qty: e.target.value })} />
                      </Td>
                      <Td>
                        <Input aria-label={`Line ${i + 1} unit price`} type="number" min={0} step="any" className="text-right font-mono" value={r.price} onChange={(e) => patchRow(r.key, { price: e.target.value })} />
                      </Td>
                      <Td>
                        <MoneyCell amount={parsed[i].qty * parsed[i].unit_price} currency={currency} />
                      </Td>
                      <Td>
                        <IconButton
                          label={`Remove line ${i + 1}`}
                          size="sm"
                          disabled={rows.length === 1}
                          onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Notes" />
            <CardBody>
              <Textarea aria-label="Notes" placeholder="Payment instructions or a short note for the client" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader title="Totals" />
            <CardBody className="flex flex-col gap-3">
              <Field label="Tax percent">
                <Input type="number" min={0} step="any" value={tax} onChange={(e) => setTax(e.target.value)} />
              </Field>
              <Field label={`Discount (${currency})`}>
                <Input type="number" min={0} step="any" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </Field>
              <dl className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Subtotal</dt>
                  <dd>
                    <MoneyCell amount={totals.subtotal} currency={currency} />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Tax</dt>
                  <dd>
                    <MoneyCell amount={totals.tax} currency={currency} />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Discount</dt>
                  <dd>
                    <MoneyCell amount={-(Number(discount) || 0)} currency={currency} />
                  </dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <dt>Total</dt>
                  <dd>
                    <MoneyCell amount={totals.total} currency={currency} />
                  </dd>
                </div>
              </dl>
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
