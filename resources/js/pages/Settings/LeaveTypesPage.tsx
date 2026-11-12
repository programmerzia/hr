import { router, useForm } from '@inertiajs/react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { HistoryPanel } from '../../components/shared/HistoryPanel'
import { PageHeader } from '../../components/shared/PageHeader'
import { Badge, Button, Dialog, Field, IconButton, Input, Switch, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { useShared } from '../../inertia/props'
import type { SettingsHistoryEntry, SettingsLeaveType } from '../../types'
import { SettingsTabs } from './SettingsTabs'

interface FormData {
  name: string
  annual_quota: number
  is_paid: boolean
  carry_forward: boolean
  allows_half_day: boolean
  carry_forward_cap: number | null
  allowed_on_probation: boolean
  encashable: boolean
}

const blank: FormData = {
  name: '',
  annual_quota: 0,
  is_paid: true,
  carry_forward: false,
  allows_half_day: true,
  carry_forward_cap: null,
  allowed_on_probation: true,
  encashable: false,
}

const yes = (b: boolean) => (b ? 'Yes' : 'No')

export default function LeaveTypesPage() {
  const { leave_types, history } = useShared<{ leave_types: SettingsLeaveType[]; history: SettingsHistoryEntry[] }>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SettingsLeaveType | null>(null)
  const [removing, setRemoving] = useState<SettingsLeaveType | null>(null)
  const form = useForm<FormData>(blank)
  const d = form.data

  const openNew = () => {
    setEditing(null)
    form.setData(blank)
    form.clearErrors()
    setOpen(true)
  }
  const openEdit = (t: SettingsLeaveType) => {
    setEditing(t)
    form.setData({
      name: t.name,
      annual_quota: t.annual_quota,
      is_paid: t.is_paid,
      carry_forward: t.carry_forward,
      allows_half_day: t.allows_half_day,
      carry_forward_cap: t.carry_forward_cap,
      allowed_on_probation: t.allowed_on_probation,
      encashable: t.encashable,
    })
    form.clearErrors()
    setOpen(true)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const opts = { preserveScroll: true, onSuccess: () => setOpen(false) }
    if (editing) form.put(route('settings.leave-types.update', editing.id), opts)
    else form.post(route('settings.leave-types.store'), opts)
  }

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="Leave types"
        description="Yearly quotas and rules for each kind of leave. Changes apply to new requests and the next year's balances."
        tabs={<SettingsTabs />}
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={openNew}>
            Add leave type
          </Button>
        }
      />
      <Table>
        <Thead>
          <tr>
            <Th>Leave type</Th>
            <Th numeric>Days per year</Th>
            <Th>Paid</Th>
            <Th>Half days</Th>
            <Th>Carry forward</Th>
            <Th>On probation</Th>
            <Th>Encashable</Th>
            <Th className="w-20" />
          </tr>
        </Thead>
        <Tbody>
          {leave_types.map((t) => (
            <Tr key={t.id}>
              <Td className="font-medium">{t.name}</Td>
              <Td numeric>{t.annual_quota === 0 && !t.is_paid ? <Badge>Unlimited</Badge> : t.annual_quota}</Td>
              <Td>{yes(t.is_paid)}</Td>
              <Td>{yes(t.allows_half_day)}</Td>
              <Td>{t.carry_forward ? (t.carry_forward_cap === null ? 'All unused' : `Up to ${t.carry_forward_cap}`) : 'No'}</Td>
              <Td>{yes(t.allowed_on_probation)}</Td>
              <Td>{yes(t.encashable)}</Td>
              <Td>
                <div className="flex justify-end">
                  <IconButton label={`Edit ${t.name}`} size="sm" onClick={() => openEdit(t)}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton label={`Delete ${t.name}`} size="sm" onClick={() => setRemoving(t)}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      <p className="mt-3 text-sm text-fg-muted">A paid type with zero days has no entitlement. An unpaid type with zero days has no limit. A type that already has requests or balances cannot be deleted.</p>
      <div className="mt-6 max-w-md">
        <HistoryPanel title="Last 10 changes" entries={history} />
      </div>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? `Edit ${editing.name}` : 'Add leave type'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={form.processing} onClick={submit}>
              {editing ? 'Save' : 'Add'}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="flex flex-col gap-3 px-4 pb-2">
          <Field label="Name" required error={form.errors.name}>
            <Input value={d.name} onChange={(e) => form.setData('name', e.target.value)} />
          </Field>
          <Field label="Days per year" required error={form.errors.annual_quota}>
            <Input type="number" min={0} max={365} step={0.5} value={d.annual_quota} onChange={(e) => form.setData('annual_quota', Number(e.target.value))} />
          </Field>
          <Switch label="Paid leave" checked={d.is_paid} onCheckedChange={(v) => form.setData('is_paid', v)} />
          <Switch label="Allow half days" checked={d.allows_half_day} onCheckedChange={(v) => form.setData('allows_half_day', v)} />
          <Switch label="Unused days carry into next year" checked={d.carry_forward} onCheckedChange={(v) => form.setData('carry_forward', v)} />
          {d.carry_forward && (
            <Field label="Carry forward at most (days)" error={form.errors.carry_forward_cap} hint="Leave empty to carry everything unused.">
              <Input
                type="number"
                min={0}
                max={365}
                step={0.5}
                value={d.carry_forward_cap ?? ''}
                onChange={(e) => form.setData('carry_forward_cap', e.target.value === '' ? null : Number(e.target.value))}
              />
            </Field>
          )}
          <Switch label="Can be taken during probation" checked={d.allowed_on_probation} onCheckedChange={(v) => form.setData('allowed_on_probation', v)} />
          <Switch label="Unused days are paid out when someone leaves" checked={d.encashable} onCheckedChange={(v) => form.setData('encashable', v)} />
        </form>
      </Dialog>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Delete leave type"
        description={removing ? `Delete ${removing.name}? This only works if nobody has requested or been given this leave.` : ''}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (removing) router.delete(route('settings.leave-types.destroy', removing.id), { preserveScroll: true })
          setRemoving(null)
        }}
      />
    </div>
  )
}
