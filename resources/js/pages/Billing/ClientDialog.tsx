import { useForm } from '@inertiajs/react'
import { Button, Dialog, Field, Input, NativeSelect, Textarea } from '../../components/ui'
import type { Client, Currency } from '../../types'
import { currencyOptions } from './helpers'

export function ClientDialog({ client, open, onOpenChange }: { client: Client | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const form = useForm<{
    name: string
    email: string
    address: string
    currency: Currency
    default_rate: string
  }>({
    name: client?.name ?? '',
    email: client?.email ?? '',
    address: client?.address ?? '',
    currency: client?.currency ?? 'USD',
    default_rate: String(client?.default_rate ?? ''),
  })
  const { data, errors } = form
  const set = <K extends keyof typeof data>(key: K, value: (typeof data)[K]) => {
    form.clearErrors()
    form.setData((d) => ({ ...d, [key]: value }))
  }

  const save = () => {
    form.transform((d) => ({
      ...d,
      default_rate: Number(d.default_rate) || 0,
    }))
    const opts = {
      preserveScroll: true,
      onSuccess: () => onOpenChange(false),
    }
    if (client) form.patch(route('billing.clients.update', client.id), opts)
    else form.post(route('billing.clients.store'), opts)
  }

  const err = errors as Record<string, string>

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
          <Button variant="primary" onClick={save} disabled={!data.name.trim() || form.processing}>
            {client ? 'Save changes' : 'Create client'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <Field label="Name" required error={err.name ?? err.billing}>
          <Input value={data.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Billing email" required error={err.email}>
          <Input type="email" value={data.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Address">
          <Textarea value={data.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency">
            <NativeSelect value={data.currency} onChange={(e) => set('currency', e.target.value as Currency)}>
              {currencyOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Default hourly rate">
            <Input type="number" min={0} value={data.default_rate} onChange={(e) => set('default_rate', e.target.value)} />
          </Field>
        </div>
      </div>
    </Dialog>
  )
}
