import { useForm } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import { Button, Dialog, Field, Input, NativeSelect, SegmentedControl, Textarea } from '../../components/ui'
import type { HalfDay, ISODate, LeaveType } from '../../types'
import { computeLeaveDays, formatDays, halfDayLabels, todayIso, type BalanceRow } from './helpers'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  leaveTypes: LeaveType[]
  onProbation?: boolean
  balances: BalanceRow[]
  holidays: ISODate[]
  weekend: number[]
}

export function RequestLeaveDialog({ open, onOpenChange, leaveTypes: allTypes, onProbation = false, balances, holidays, weekend }: Props) {
  const leaveTypes = allTypes.filter((t) => !onProbation || t.allowed_on_probation)
  const defaultType = (leaveTypes.find((t) => /casual/i.test(t.name)) ?? leaveTypes[0])?.id ?? ''
  const form = useForm({
    leave_type_id: defaultType,
    starts_on: todayIso(),
    ends_on: todayIso(),
    half_day: 'none' as HalfDay,
    reason: '',
    attachment: null as File | null,
  })
  const [touched, setTouched] = useState(false)
  const { data } = form

  const type = leaveTypes.find((t) => t.id === data.leave_type_id)
  const singleDay = data.starts_on === data.ends_on
  const effectiveHalf: HalfDay = type?.allows_half_day && singleDay ? data.half_day : 'none'
  const days = useMemo(
    () => (data.starts_on && data.ends_on ? computeLeaveDays(data.starts_on, data.ends_on, effectiveHalf, holidays, weekend) : 0),
    [data.starts_on, data.ends_on, effectiveHalf, holidays, weekend],
  )
  const year = Number(data.starts_on.slice(0, 4) || new Date().getFullYear())
  const balance = balances.find((b) => b.leave_type_id === data.leave_type_id && b.year === year)

  const reversed = !!data.starts_on && !!data.ends_on && data.ends_on < data.starts_on
  const noHolidayYears = [...new Set([data.starts_on, data.ends_on].filter(Boolean).map((d) => d.slice(0, 4)))].filter(
    (y) => !holidays.some((h) => h.startsWith(y)),
  )
  const reasonError = touched && !data.reason.trim() ? 'Add a reason' : undefined
  const change = <K extends keyof typeof data>(key: K, value: (typeof data)[K]) => {
    form.clearErrors()
    form.setData((d) => ({ ...d, [key]: value }))
  }

  const submit = () => {
    setTouched(true)
    if (!data.reason.trim()) return
    form.transform((d) => ({ ...d, half_day: effectiveHalf }))
    form.post(route('leave.store'), {
      forceFormData: true,
      preserveScroll: true,
      onSuccess: () => {
        form.reset('reason', 'attachment', 'half_day')
        setTouched(false)
        onOpenChange(false)
      },
    })
  }

  const errors = form.errors as Record<string, string>
  const error = errors.leave ?? Object.values(errors)[0]

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Request leave"
      description="Your team lead and then HR will review this request."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!data.reason.trim() || !data.starts_on || !data.ends_on || reversed || form.processing}>
            Submit request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Leave type">
          <NativeSelect value={data.leave_type_id} onChange={(e) => change('leave_type_id', e.target.value)}>
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <Input
              type="date"
              value={data.starts_on}
              onChange={(e) => {
                form.clearErrors()
                form.setData((d) => ({ ...d, starts_on: e.target.value, ends_on: e.target.value > d.ends_on ? e.target.value : d.ends_on }))
              }}
            />
          </Field>
          <Field label="To">
            <Input type="date" value={data.ends_on} min={data.starts_on} onChange={(e) => change('ends_on', e.target.value)} />
          </Field>
        </div>
        {type?.allows_half_day && singleDay && (
          <Field label="Duration">
            <SegmentedControl
              aria-label="Duration"
              value={data.half_day}
              onValueChange={(v) => change('half_day', v)}
              options={(['none', 'first_half', 'second_half'] as const).map((v) => ({ value: v, label: halfDayLabels[v] }))}
            />
          </Field>
        )}
        <p className="text-sm text-fg-muted">
          {reversed
            ? 'End date is before the start date.'
            : days > 0
              ? `${formatDays(days)} excluding weekends and holidays.`
              : 'No working days in this range.'}
          {balance && !balance.unlimited && ` ${balance.available} available in ${balance.year}.`}
        </p>
        {noHolidayYears.length > 0 && !reversed && (
          <p className="text-xs text-fg-muted">
            No public holidays are configured for {noHolidayYears.join(' and ')}, so holidays are counted as working days here.
          </p>
        )}
        <Field label="Reason" error={reasonError} required>
          <Textarea value={data.reason} onChange={(e) => change('reason', e.target.value)} />
        </Field>
        <Field label="Attachment" hint="Sick note or other document. PDF, JPG or PNG, up to 5 MB. Optional.">
          <Input
            key={data.attachment ? 'file' : 'empty'}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(e) => change('attachment', e.target.files?.[0] ?? null)}
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  )
}
