import { FileText, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { MoneyCell } from '../../components/shared/MoneyCell'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { StackedBar } from '../../components/charts/StackedBar'
import { Button, Card, CardBody, Input, NativeSelect, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { useBilling } from '../../mock/stores/billing'
import { useWork } from '../../mock/stores/work'
import type { InvoiceStatus } from '../../types'
import { balanceOf, isoToday, sumByCurrency } from './helpers'
import { useInvoiceAging } from './useInvoiceAging'

const statusOptions: { value: 'all' | InvoiceStatus; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' },
]

export function InvoicesPage() {
  const navigate = useNavigate()
  const { invoices, clients, payments, sweepOverdue } = useBilling()
  const projects = useWork((s) => s.projects)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | InvoiceStatus>('all')
  const [clientId, setClientId] = useState('all')

  useEffect(() => {
    sweepOverdue()
  }, [sweepOverdue])

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? id
  const projectName = (id: string | null) => (id ? (projects.find((p) => p.id === id)?.name ?? id) : null)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...invoices]
      .filter((i) => status === 'all' || i.status === status)
      .filter((i) => clientId === 'all' || i.client_id === clientId)
      .filter((i) => !q || i.number.toLowerCase().includes(q) || clientName(i.client_id).toLowerCase().includes(q))
      .sort((a, b) => b.number.localeCompare(a.number))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, clients, query, status, clientId])

  const aging = useInvoiceAging()
  const monthPrefix = isoToday().slice(0, 7)
  const open = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue')
  const currencyOf = (invoiceId: string) => invoices.find((i) => i.id === invoiceId)?.currency ?? 'BDT'

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="Invoices"
        description="Client invoices and retainers."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/invoices/new')}>
            New invoice
          </Button>
        }
      />

      <Card className="mb-4">
        <CardBody className="space-y-5">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-fg-muted">Outstanding</dt>
              <dd className="mt-1 font-mono text-xl font-medium tabular-nums">
                {sumByCurrency(open.map((i) => ({ currency: i.currency, amount: balanceOf(i) })))}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-fg-muted">Overdue</dt>
              <dd className="mt-1 font-mono text-xl font-medium tabular-nums text-danger" data-warning>
                {sumByCurrency(
                  invoices.filter((i) => i.status === 'overdue').map((i) => ({ currency: i.currency, amount: balanceOf(i) })),
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-fg-muted">Paid this month</dt>
              <dd className="mt-1 font-mono text-xl font-medium tabular-nums">
                {sumByCurrency(
                  payments
                    .filter((p) => p.paid_on.startsWith(monthPrefix))
                    .map((p) => ({ currency: currencyOf(p.invoice_id), amount: p.amount })),
                )}
              </dd>
            </div>
          </dl>
          {aging.length > 0 && (
            <div className="grid gap-5 border-t border-border pt-4 lg:grid-cols-2">
              {aging.map((row) => (
                <div key={row.currency}>
                  <p className="mb-2 text-sm text-fg-muted">Aging, {row.currency}</p>
                  <StackedBar segments={row.segments} height={8} aria-label={`Outstanding ${row.currency} by age`} />
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input
            aria-label="Search invoices"
            placeholder="Search number or client"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="w-40">
          <NativeSelect aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as 'all' | InvoiceStatus)}>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="w-48">
          <NativeSelect aria-label="Filter by client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="all">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyTable
          icon={FileText}
          title={invoices.length === 0 ? 'No invoices yet' : 'No invoices match these filters'}
          description={invoices.length === 0 ? 'Create the first invoice for a client.' : 'Clear the search or change a filter.'}
        />
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Number</Th>
              <Th>Client</Th>
              <Th>Project</Th>
              <Th>Issued</Th>
              <Th>Due</Th>
              <Th numeric>Total</Th>
              <Th numeric>Paid</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <Tbody>
            {rows.map((i) => (
              <Tr key={i.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${i.id}`)}>
                <Td className="font-mono">{i.number}</Td>
                <Td>{clientName(i.client_id)}</Td>
                <Td className="text-fg-muted">{projectName(i.project_id) ?? 'Retainer'}</Td>
                <Td className="text-fg-muted">{formatDate(i.issued_on)}</Td>
                <Td className={i.status === 'overdue' ? 'text-danger' : 'text-fg-muted'}>{formatDate(i.due_on)}</Td>
                <Td>
                  <MoneyCell amount={i.total} currency={i.currency} />
                </Td>
                <Td>
                  <MoneyCell amount={i.paid_total} currency={i.currency} className={i.paid_total === 0 ? 'text-fg-subtle' : undefined} />
                </Td>
                <Td>
                  <StatusBadge status={i.status} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
