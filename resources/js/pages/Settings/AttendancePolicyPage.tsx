import { router, useForm } from '@inertiajs/react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { HistoryPanel } from '../../components/shared/HistoryPanel'
import { PageHeader } from '../../components/shared/PageHeader'
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, Field, IconButton, Input, Switch, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { useShared } from '../../inertia/props'
import { formatDate } from '../../lib/format'
import type { AttendancePolicyVersion, SettingsHistoryEntry } from '../../types'
import { SettingsTabs } from './SettingsTabs'

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Props {
  versions: AttendancePolicyVersion[]
  today: string
  defaults: Omit<AttendancePolicyVersion, 'id' | 'is_current' | 'editable'>
  history: SettingsHistoryEntry[]
}

type FormData = Omit<AttendancePolicyVersion, 'id' | 'is_current' | 'editable'>

const pick = (v: AttendancePolicyVersion | FormData, effective_from: string): FormData => ({
  shift_start: v.shift_start,
  shift_end: v.shift_end,
  grace_minutes: v.grace_minutes,
  standard_minutes: v.standard_minutes,
  idle_timeout_minutes: v.idle_timeout_minutes,
  lunch_cap_minutes: v.lunch_cap_minutes,
  half_day_after_minutes: v.half_day_after_minutes,
  early_leave_grace_minutes: v.early_leave_grace_minutes,
  early_counts_as_late: v.early_counts_as_late,
  half_day_min_minutes: v.half_day_min_minutes,
  absent_below_minutes: v.absent_below_minutes,
  weekend_days: [...v.weekend_days],
  effective_from,
})

export default function AttendancePolicyPage() {
  const { versions, today, history } = useShared<Props>()
  const current = versions.find((v) => v.is_current) ?? versions[0]
  const [editing, setEditing] = useState<AttendancePolicyVersion | null>(null)
  const [removing, setRemoving] = useState<AttendancePolicyVersion | null>(null)
  const form = useForm<FormData>(pick(current, today))
  const num = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => form.setData(k, Number(e.target.value) as never)

  const startNew = () => {
    setEditing(null)
    form.setData(pick(current, today))
    form.clearErrors()
  }
  const startEdit = (v: AttendancePolicyVersion) => {
    setEditing(v)
    form.setData(pick(v, v.effective_from))
    form.clearErrors()
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const opts = { preserveScroll: true, onSuccess: () => setEditing(null) }
    if (editing) form.put(route('settings.attendance.update', editing.id), opts)
    else form.post(route('settings.attendance.store'), opts)
  }
  const toggleDay = (d: number, on: boolean) =>
    form.setData('weekend_days', on ? [...form.data.weekend_days, d].sort() : form.data.weekend_days.filter((x) => x !== d))
  const status = (v: AttendancePolicyVersion) =>
    v.is_current ? <Badge variant="success">In force now</Badge> : v.editable ? <Badge variant="info">Upcoming</Badge> : <Badge>Past</Badge>

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="Attendance policy"
        description="Working hours and the rules that grade each day. A change never rewrites past days; it applies from the date you pick."
        tabs={<SettingsTabs />}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="Versions"
              actions={
                <Button size="sm" variant="secondary" icon={<Plus size={16} />} onClick={startNew}>
                  New version
                </Button>
              }
            />
            <Table>
              <Thead>
                <tr>
                  <Th>Starts</Th>
                  <Th>Shift</Th>
                  <Th numeric>Grace</Th>
                  <Th>Weekend</Th>
                  <Th>Status</Th>
                  <Th className="w-24" />
                </tr>
              </Thead>
              <Tbody>
                {versions.map((v) => (
                  <Tr key={v.id} className={v.is_current ? 'bg-accent-soft' : undefined}>
                    <Td className="font-medium">{formatDate(v.effective_from)}</Td>
                    <Td>
                      {v.shift_start} to {v.shift_end}
                    </Td>
                    <Td numeric>{v.grace_minutes} min</Td>
                    <Td>{v.weekend_days.map((d) => days[d]).join(', ') || 'None'}</Td>
                    <Td>{status(v)}</Td>
                    <Td>
                      <div className="flex justify-end">
                        {v.editable ? (
                          <>
                            <IconButton label="Edit upcoming version" size="sm" onClick={() => startEdit(v)}>
                              <Pencil size={16} />
                            </IconButton>
                            <IconButton label="Remove upcoming version" size="sm" onClick={() => setRemoving(v)}>
                              <Trash2 size={16} />
                            </IconButton>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditing(null)
                              form.setData(pick(v, today))
                              form.clearErrors()
                            }}
                          >
                            Copy
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>
          <HistoryPanel title="Last 10 changes" entries={history} />
        </div>

        <Card className="h-fit">
          <CardHeader title={editing ? 'Edit upcoming version' : 'New version'} />
          <CardBody>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Field label="Takes effect from" required error={form.errors.effective_from} hint={`Must be ${formatDate(today)} or later.`}>
                <Input type="date" min={today} value={form.data.effective_from} onChange={(e) => form.setData('effective_from', e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Shift starts" required error={form.errors.shift_start}>
                  <Input type="time" value={form.data.shift_start} onChange={(e) => form.setData('shift_start', e.target.value)} />
                </Field>
                <Field label="Shift ends" required error={form.errors.shift_end}>
                  <Input type="time" value={form.data.shift_end} onChange={(e) => form.setData('shift_end', e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Late grace (min)" error={form.errors.grace_minutes} hint="Login after start plus this counts as late.">
                  <Input type="number" min={0} max={120} value={form.data.grace_minutes} onChange={num('grace_minutes')} />
                </Field>
                <Field label="Full day (min)" error={form.errors.standard_minutes} hint="Expected work per day.">
                  <Input type="number" min={60} max={960} value={form.data.standard_minutes} onChange={num('standard_minutes')} />
                </Field>
                <Field label="Idle timeout (min)" error={form.errors.idle_timeout_minutes} hint="No activity for this long marks the person offline.">
                  <Input type="number" min={1} max={120} value={form.data.idle_timeout_minutes} onChange={num('idle_timeout_minutes')} />
                </Field>
                <Field label="Lunch cap (min)" error={form.errors.lunch_cap_minutes} hint="Longest lunch break that is not flagged.">
                  <Input type="number" min={0} max={240} value={form.data.lunch_cap_minutes} onChange={num('lunch_cap_minutes')} />
                </Field>
              </div>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Weekend days</legend>
                <div className="flex flex-wrap gap-x-3 gap-y-2">
                  {days.map((label, d) => (
                    <Checkbox key={label} label={label} checked={form.data.weekend_days.includes(d)} onCheckedChange={(v) => toggleDay(d, v === true)} />
                  ))}
                </div>
                {form.errors.weekend_days && <p className="mt-1 text-xs text-danger">{form.errors.weekend_days}</p>}
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Half day if login later than (min)" error={form.errors.half_day_after_minutes} hint="After shift start.">
                  <Input type="number" min={15} max={480} value={form.data.half_day_after_minutes} onChange={num('half_day_after_minutes')} />
                </Field>
                <Field label="Early leave grace (min)" error={form.errors.early_leave_grace_minutes} hint="Leaving earlier than shift end minus this is early.">
                  <Input type="number" min={0} max={240} value={form.data.early_leave_grace_minutes} onChange={num('early_leave_grace_minutes')} />
                </Field>
                <Field label="Half day if worked under (min)" error={form.errors.half_day_min_minutes}>
                  <Input type="number" min={30} max={720} value={form.data.half_day_min_minutes} onChange={num('half_day_min_minutes')} />
                </Field>
                <Field label="Absent if worked under (min)" error={form.errors.absent_below_minutes} hint="Unless on leave or a holiday.">
                  <Input type="number" min={0} max={480} value={form.data.absent_below_minutes} onChange={num('absent_below_minutes')} />
                </Field>
              </div>
              <Switch
                label="Leaving early counts toward the late penalty"
                checked={form.data.early_counts_as_late}
                onCheckedChange={(v) => form.setData('early_counts_as_late', v)}
              />
              <p className="rounded border border-border bg-surface-2 px-3 py-2 text-sm text-fg-muted">
                {form.data.effective_from
                  ? `This version takes effect from ${formatDate(form.data.effective_from)}. Days before then keep the rules they had.`
                  : 'Pick a start date.'}
              </p>
              <div className="flex justify-end gap-2">
                {editing && (
                  <Button variant="ghost" onClick={startNew}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" variant="primary" loading={form.processing}>
                  {editing ? 'Save changes' : 'Create version'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove upcoming version"
        description={removing ? `The version starting ${formatDate(removing.effective_from)} will be deleted. The current rules stay in force.` : ''}
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (removing) router.delete(route('settings.attendance.destroy', removing.id), { preserveScroll: true })
          setRemoving(null)
        }}
      />
    </div>
  )
}
