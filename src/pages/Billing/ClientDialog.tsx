import { useState } from 'react'
import { Button, Dialog, Field, Input, NativeSelect, Textarea } from '../../components/ui'
import { useBilling, type ClientInput } from '../../mock/stores/billing'
import type { Client, Currency } from '../../types'
import { currencyOptions } from './helpers'

export function ClientDialog({ client, open, onOpenChange }: { client: Client | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const createClient = useBilling((s) => s.createClient)
  const updateClient = useBilling((s) => s.updateClient)
  const [form, setForm] = useState<{ name: string; email: string; address: string; currency: Currency; rate: string }>({
    name: client?.name ?? '',
    email: client?.email ?? '',
    address: client?.address ?? '',
    currency: client?.currency ?? 'USD',
    rate: String(client?.default_rate ?? ''),
  })
  const [error, setError] = useState<string | undefined>()

  const save = () => {
    const input: ClientInput = {
      name: form.name,
      email: form.email,
      address: form.address,
      currency: form.currency,
      default_rate: Number(form.rate) || 0,
    }
    const res = client ? updateClient(client.id, input) : createClient(input)
    if (!res.ok) return setError(res.error)
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={client ? 'Edit client' : 'New client'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            {client ? 'Save changes' : 'Create client'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <Field label="Name" required error={error}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Billing email" required>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Address">
          <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency">
            <NativeSelect value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as Currency })}>
              {currencyOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Default hourly rate">
            <Input type="number" min={0} value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
          </Field>
        </div>
      </div>
    </Dialog>
  )
}
