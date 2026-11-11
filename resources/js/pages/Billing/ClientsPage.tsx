import { router } from '@inertiajs/react'
import { Building2, Plus } from 'lucide-react'
import { useState } from 'react'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { MoneyCell } from '../../components/shared/MoneyCell'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Button, Sheet, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { formatDate, formatMoney } from '../../lib/format'
import { useShared } from '../../inertia/props'
import type { Client, Invoice } from '../../types'
import { ClientDialog } from './ClientDialog'
import { balanceOf, invoiceLabel, sumByCurrency, type ProjectRef } from './helpers'

export default function ClientsPage() {
  const { clients, invoices, projects } = useShared<{
    clients: Client[]
    invoices: Invoice[]
    projects: ProjectRef[]
  }>()
  const [editing, setEditing] = useState<Client | null>(null)
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const open = clients.find((c) => c.id === openId) ?? null
  const outstandingOf = (id: string) =>
    sumByCurrency(
      invoices
        .filter((i) => i.client_id === id && (i.status === 'sent' || i.status === 'overdue'))
        .map((i) => ({ currency: i.currency, amount: balanceOf(i) })),
    )

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="Clients"
        description="Who we bill, and what they owe."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            New client
          </Button>
        }
      />

      {clients.length === 0 ? (
        <EmptyTable icon={Building2} title="No clients yet" description="Add a client to start invoicing." />
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Name</Th>
              <Th>Billing email</Th>
              <Th>Currency</Th>
              <Th numeric>Default rate</Th>
              <Th numeric>Projects</Th>
              <Th numeric>Outstanding</Th>
            </tr>
          </Thead>
          <Tbody>
            {clients.map((c) => (
              <Tr key={c.id} className="cursor-pointer" onClick={() => setOpenId(c.id)}>
                <Td>
                  <button
                    type="button"
                    className="rounded font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenId(c.id)
                    }}
                  >
                    {c.name}
                  </button>
                </Td>
                <Td className="text-fg-muted">{c.email}</Td>
                <Td>{c.currency}</Td>
                <Td numeric>{formatMoney(c.default_rate, c.currency)}/h</Td>
                <Td numeric>{projects.filter((p) => p.client_id === c.id).length}</Td>
                <Td numeric>{outstandingOf(c.id)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {creating && <ClientDialog key="new" client={null} open onOpenChange={setCreating} />}
      {editing && <ClientDialog key={editing.id} client={editing} open onOpenChange={(o) => !o && setEditing(null)} />}

      <Sheet
        open={open !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
        title={open?.name ?? 'Client'}
        description={open?.email}
        footer={
          open && (
            <Button
              onClick={() => {
                setEditing(open)
                setOpenId(null)
              }}
            >
              Edit client
            </Button>
          )
        }
      >
        {open && (
          <div className="flex flex-col gap-4 p-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-fg-muted">Currency</dt>
                <dd>{open.currency}</dd>
              </div>
              <div>
                <dt className="text-fg-muted">Default rate</dt>
                <dd className="font-mono tabular-nums">
                  {formatMoney(open.default_rate, open.currency)}
                  /h
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-fg-muted">Address</dt>
                <dd className="whitespace-pre-line">{open.address || '-'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-fg-muted">Projects</dt>
                <dd>
                  {projects
                    .filter((p) => p.client_id === open.id)
                    .map((p) => p.name)
                    .join(', ') || 'None'}
                </dd>
              </div>
            </dl>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-base font-semibold">Invoices</h3>
                <Button size="sm" onClick={() => router.get(route('billing.invoices.create'), { client: open.id })}>
                  New invoice
                </Button>
              </div>
              {invoices.filter((i) => i.client_id === open.id).length === 0 ? (
                <p className="text-sm text-fg-muted">No invoices for this client yet.</p>
              ) : (
                <Table>
                  <Thead>
                    <tr>
                      <Th>Number</Th>
                      <Th>Issued</Th>
                      <Th numeric>Total</Th>
                      <Th>Status</Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    {invoices
                      .filter((i) => i.client_id === open.id)
                      .sort((a, b) => b.issued_on.localeCompare(a.issued_on))
                      .map((i) => (
                        <Tr key={i.id} className="cursor-pointer" onClick={() => router.visit(route('billing.invoices.show', i.id))}>
                          <Td className="font-mono">{invoiceLabel(i)}</Td>
                          <Td className="text-fg-muted">{formatDate(i.issued_on)}</Td>
                          <Td>
                            <MoneyCell amount={i.total} currency={i.currency} />
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
          </div>
        )}
      </Sheet>
    </div>
  )
}
