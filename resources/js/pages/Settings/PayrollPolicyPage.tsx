import { router, useForm } from '@inertiajs/react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { HistoryPanel } from '../../components/shared/HistoryPanel'
import { PageHeader } from '../../components/shared/PageHeader'
import { Badge, Button, Card, CardBody, CardHeader, Field, IconButton, Input, RadioGroup, Switch, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { useShared } from '../../inertia/props'
import { formatDate, formatMoney } from '../../lib/format'
import type { PayrollPolicyFields, PayrollPolicyVersion, PolicyPreviewResult, SettingsHistoryEntry } from '../../types'
import { SettingsTabs } from './SettingsTabs'

interface Props {
  versions: PayrollPolicyVersion[]
  today: string
  example_gross: number
  preview: PolicyPreviewResult | null
  history: SettingsHistoryEntry[]
}

const basisOptions = [
  { value: 'working_days', label: 'Working days of the month', hint: 'Daily rate = monthly gross ÷ days that are not weekends or holidays. Shorter months cost more per day.' },
  { value: 'calendar_days', label: 'Calendar days of the month', hint: 'Daily rate = monthly gross ÷ 28 to 31, every day counted.' },
  { value: 'fixed_30', label: 'Fixed 30 days', hint: 'Daily rate = monthly gross ÷ 30 in every month.' },
  { value: 'fixed_26', label: 'Fixed 26 days', hint: 'Daily rate = monthly gross ÷ 26, a six-day working month.' },
]

const pick = (v: PayrollPolicyFields, effective_from: string): PayrollPolicyFields => ({
  daily_rate_basis: v.daily_rate_basis,
  lop_enabled: v.lop_enabled,
  late_penalty_enabled: v.late_penalty_enabled,
  lates_per_penalty: v.lates_per_penalty,
  penalty_days: v.penalty_days,
  max_penalty_days_per_month: v.max_penalty_days_per_month,
  pf_enabled: v.pf_enabled,
  pf_employee_percent: v.pf_employee_percent,
  pf_employer_percent: v.pf_employer_percent,
  tax_enabled: v.tax_enabled,
  overtime_enabled: v.overtime_enabled,
  overtime_multiplier: v.overtime_multiplier,
  overtime_requires_approval: v.overtime_requires_approval,
  overtime_min_block_minutes: v.overtime_min_block_minutes,
  overtime_daily_cap_minutes: v.overtime_daily_cap_minutes,
  effective_from,
})

function Section({ title, help, switchLabel, on, onChange, children }: {
  title: string
  help: string
  switchLabel: string
  on: boolean
  onChange: (v: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <section className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mb-2 mt-0.5 text-xs text-fg-muted">{help}</p>
      <Switch label={switchLabel} checked={on} onCheckedChange={onChange} />
      {on && children && <div className="mt-3 grid grid-cols-2 gap-3">{children}</div>}
    </section>
  )
}

export default function PayrollPolicyPage() {
  const { versions, today, example_gross, preview, history } = useShared<Props>()
  const current = versions.find((v) => v.is_current) ?? versions[0]
  const [editing, setEditing] = useState<PayrollPolicyVersion | null>(null)
  const [removing, setRemoving] = useState<PayrollPolicyVersion | null>(null)
  const form = useForm<PayrollPolicyFields>(pick(current, today))
  const d = form.data
  const set = <K extends keyof PayrollPolicyFields>(k: K, v: PayrollPolicyFields[K]) => form.setData(k, v as never)
  const num = (k: keyof PayrollPolicyFields) => (e: React.ChangeEvent<HTMLInputElement>) => form.setData(k, Number(e.target.value) as never)

  // Live preview: ask the server for the numbers whenever a pricing field changes.
  const first = useRef(true)
  const key = [d.daily_rate_basis, d.lop_enabled, d.late_penalty_enabled, d.lates_per_penalty, d.penalty_days, d.max_penalty_days_per_month, d.effective_from].join('|')
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = setTimeout(() => {
      router.get(
        route('settings.payroll.index'),
        { p: { ...d, lop_enabled: d.lop_enabled ? 1 : 0, late_penalty_enabled: d.late_penalty_enabled ? 1 : 0 } } as never,
        { only: ['preview'], preserveState: true, preserveScroll: true, replace: true },
      )
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const reset = (v: PayrollPolicyFields) => {
    form.setData(v)
    form.clearErrors()
  }
  const startNew = () => {
    setEditing(null)
    reset(pick(current, today))
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const opts = { preserveScroll: true, onSuccess: () => setEditing(null) }
    if (editing) form.put(route('settings.payroll.update', editing.id), opts)
    else form.post(route('settings.payroll.store'), opts)
  }
  const status = (v: PayrollPolicyVersion) =>
    v.is_current ? <Badge variant="success">In force now</Badge> : v.editable ? <Badge variant="info">Upcoming</Badge> : <Badge>Past</Badge>
  const onOff = (b: boolean) => (b ? 'On' : 'Off')

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="Payroll policy"
        description="Salary is a fixed monthly amount. These switches decide what is deducted from it, and from which date."
        tabs={<SettingsTabs />}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
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
                  <Th>Absence</Th>
                  <Th>Late</Th>
                  <Th>PF</Th>
                  <Th>Tax</Th>
                  <Th>Overtime</Th>
                  <Th>Status</Th>
                  <Th className="w-24" />
                </tr>
              </Thead>
              <Tbody>
                {versions.map((v) => (
                  <Tr key={v.id} className={v.is_current ? 'bg-accent-soft' : undefined}>
                    <Td className="font-medium">{formatDate(v.effective_from)}</Td>
                    <Td>{onOff(v.lop_enabled)}</Td>
                    <Td>{onOff(v.late_penalty_enabled)}</Td>
                    <Td>{v.pf_enabled ? `${v.pf_employee_percent}% / ${v.pf_employer_percent}%` : 'Off'}</Td>
                    <Td>{onOff(v.tax_enabled)}</Td>
                    <Td>{onOff(v.overtime_enabled)}</Td>
                    <Td>{status(v)}</Td>
                    <Td>
                      <div className="flex justify-end">
                        {v.editable ? (
                          <>
                            <IconButton label="Edit upcoming version" size="sm" onClick={() => { setEditing(v); reset(pick(v, v.effective_from)) }}>
                              <Pencil size={16} />
                            </IconButton>
                            <IconButton label="Remove upcoming version" size="sm" onClick={() => setRemoving(v)}>
                              <Trash2 size={16} />
                            </IconButton>
                          </>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => { setEditing(null); reset(pick(v, today)) }}>
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

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="What this does to a salary" />
            <CardBody className="text-sm">
              {preview ? (
                <>
                  <p className="text-fg-muted">
                    Example: {formatMoney(example_gross)} a month, {preview.month}. Daily rate is {formatMoney(preview.gross)} ÷ {preview.divisor} ={' '}
                    <span className="font-medium text-fg">{formatMoney(preview.daily_rate)}</span>.
                  </p>
                  <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
                    <dt>One absence</dt>
                    <dd className="text-right tabular-nums">{formatMoney(preview.absence)}</dd>
                    <dt>One half day</dt>
                    <dd className="text-right tabular-nums">{formatMoney(preview.half_day)}</dd>
                    <dt>Three lates in a month</dt>
                    <dd className="text-right tabular-nums">{formatMoney(preview.lates)}</dd>
                  </dl>
                </>
              ) : (
                <p className="text-fg-muted">Change a setting to see the effect on a {formatMoney(example_gross)} salary.</p>
              )}
            </CardBody>
          </Card>

          <Card className="h-fit">
            <CardHeader title={editing ? 'Edit upcoming version' : 'New version'} />
            <CardBody>
              <form onSubmit={submit} className="flex flex-col gap-4">
                <Field label="Takes effect from" required error={form.errors.effective_from} hint={`Must be ${formatDate(today)} or later. Payroll for earlier months keeps its own rules.`}>
                  <Input type="date" min={today} value={d.effective_from} onChange={(e) => set('effective_from', e.target.value)} />
                </Field>

                <section>
                  <h3 className="text-sm font-semibold">Daily rate</h3>
                  <p className="mb-2 mt-0.5 text-xs text-fg-muted">Used only to price deductions. The monthly salary itself is never rebuilt from days.</p>
                  <RadioGroup
                    aria-label="Daily rate basis"
                    value={d.daily_rate_basis}
                    onValueChange={(v) => set('daily_rate_basis', v as PayrollPolicyFields['daily_rate_basis'])}
                    options={basisOptions}
                  />
                </section>

                <Section
                  title="Loss of pay"
                  help="Takes money off for days not worked and not covered by paid leave."
                  switchLabel="Deduct for absences and half days"
                  on={d.lop_enabled}
                  onChange={(v) => set('lop_enabled', v)}
                />

                <Section
                  title="Late penalty"
                  help="Turns repeated late arrivals into a deduction of whole or part days."
                  switchLabel="Deduct for repeated lates"
                  on={d.late_penalty_enabled}
                  onChange={(v) => set('late_penalty_enabled', v)}
                >
                  <Field label="Lates per penalty" error={form.errors.lates_per_penalty} hint="Every this many lates triggers one penalty.">
                    <Input type="number" min={1} max={31} value={d.lates_per_penalty} onChange={num('lates_per_penalty')} />
                  </Field>
                  <Field label="Days deducted per penalty" error={form.errors.penalty_days} hint="0.5 is half a day.">
                    <Input type="number" min={0.25} max={5} step={0.25} value={d.penalty_days} onChange={num('penalty_days')} />
                  </Field>
                  <Field label="Most days deducted per month" error={form.errors.max_penalty_days_per_month} className="col-span-2">
                    <Input type="number" min={0} max={31} step={0.5} value={d.max_penalty_days_per_month} onChange={num('max_penalty_days_per_month')} />
                  </Field>
                </Section>

                <Section
                  title="Provident fund"
                  help="Off unless you turn it on. A salary structure can override the percentages for one person."
                  switchLabel="Deduct provident fund from basic pay"
                  on={d.pf_enabled}
                  onChange={(v) => set('pf_enabled', v)}
                >
                  <Field label="Employee share (%)" error={form.errors.pf_employee_percent} hint="Taken from the employee's pay.">
                    <Input type="number" min={0} max={30} step={0.5} value={d.pf_employee_percent} onChange={num('pf_employee_percent')} />
                  </Field>
                  <Field label="Employer share (%)" error={form.errors.pf_employer_percent} hint="Paid by the company on top.">
                    <Input type="number" min={0} max={30} step={0.5} value={d.pf_employer_percent} onChange={num('pf_employer_percent')} />
                  </Field>
                </Section>

                <Section
                  title="Tax"
                  help="Deducts the monthly TDS entered on each salary structure. The app does not work out tax slabs."
                  switchLabel="Deduct the monthly tax on each salary structure"
                  on={d.tax_enabled}
                  onChange={(v) => set('tax_enabled', v)}
                />

                <Section
                  title="Overtime"
                  help="Pays extra for work beyond the full day, and for work on weekends and holidays."
                  switchLabel="Pay overtime"
                  on={d.overtime_enabled}
                  onChange={(v) => set('overtime_enabled', v)}
                >
                  <Field label="Pay multiplier" error={form.errors.overtime_multiplier} hint="1.5 means time and a half.">
                    <Input type="number" min={1} max={5} step={0.25} value={d.overtime_multiplier} onChange={num('overtime_multiplier')} />
                  </Field>
                  <Field label="Smallest block (min)" error={form.errors.overtime_min_block_minutes} hint="Overtime is counted in blocks this long.">
                    <Input type="number" min={1} max={240} value={d.overtime_min_block_minutes} onChange={num('overtime_min_block_minutes')} />
                  </Field>
                  <Field label="Daily cap (min)" error={form.errors.overtime_daily_cap_minutes} hint="Most overtime paid for one day.">
                    <Input type="number" min={0} max={720} value={d.overtime_daily_cap_minutes} onChange={num('overtime_daily_cap_minutes')} />
                  </Field>
                  <div className="self-end pb-1">
                    <Switch label="Needs approval" checked={d.overtime_requires_approval} onCheckedChange={(v) => set('overtime_requires_approval', v)} />
                  </div>
                </Section>

                <p className="rounded border border-border bg-surface-2 px-3 py-2 text-sm text-fg-muted">
                  {d.effective_from
                    ? `This version takes effect from ${formatDate(d.effective_from)}. Runs for earlier months are not recalculated.`
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
      </div>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove upcoming version"
        description={removing ? `The version starting ${formatDate(removing.effective_from)} will be deleted. The current rules stay in force.` : ''}
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (removing) router.delete(route('settings.payroll.destroy', removing.id), { preserveScroll: true })
          setRemoving(null)
        }}
      />
    </div>
  )
}
