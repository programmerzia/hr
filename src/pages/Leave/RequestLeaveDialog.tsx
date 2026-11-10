import { useMemo, useState } from 'react'
import { Button, Dialog, Field, Input, NativeSelect, SegmentedControl, Textarea } from '../../components/ui'
import { useLeaveStore } from '../../mock/stores/leave'
import { todayIso } from '../../mock/stores/people'
import type { HalfDay } from '../../types'
import { formatDays, halfDayLabels } from './helpers'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeId: string
}

export function RequestLeaveDialog({ open, onOpenChange, employeeId }: Props) {
  const leave = useLeaveStore()
  const [typeId, setTypeId] = useState('lt-casual')
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  const [half, setHalf] = useState<HalfDay>('none')
  const [reason, setReason] = useState('')
  const [attachment, setAttachment] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [touched, setTouched] = useState(false)

  const type = leave.leaveTypes.find((t) => t.id === typeId)
  const singleDay = from === to
  const effectiveHalf: HalfDay = type?.allows_half_day && singleDay ? half : 'none'
  const days = useMemo(() => (from && to ? leave.daysFor(from, to, effectiveHalf) : 0), [leave, from, to, effectiveHalf])
  const balance = leave.balancesFor(employeeId, Number(from.slice(0, 4) || new Date().getFullYear())).find((b) => b.leave_type_id === typeId)

  const reasonError = touched && !reason.trim() ? 'Add a reason' : undefined

  const submit = () => {
    setTouched(true)
    if (!reason.trim()) return
    const res = leave.submitLeave(employeeId, typeId, from, to, effectiveHalf, reason, attachment)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setReason('')
    setAttachment('')
    setHalf('none')
    setTouched(false)
    setError(undefined)
    onOpenChange(false)
  }

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
          <Button variant="primary" onClick={submit}>
            Submit request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Leave type">
          <NativeSelect
            value={typeId}
            onChange={(e) => {
              setTypeId(e.target.value)
              setError(undefined)
            }}
          >
            {leave.leaveTypes.map((t) => (
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
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                if (e.target.value > to) setTo(e.target.value)
                setError(undefined)
              }}
            />
          </Field>
          <Field label="To">
            <Input type="date" value={to} min={from} onChange={(e) => { setTo(e.target.value); setError(undefined) }} />
          </Field>
        </div>
        {type?.allows_half_day && singleDay && (
          <Field label="Duration">
            <SegmentedControl
              aria-label="Duration"
              value={half}
              onValueChange={setHalf}
              options={(['none', 'first_half', 'second_half'] as const).map((v) => ({ value: v, label: halfDayLabels[v] }))}
            />
          </Field>
        )}
        <p className="text-sm text-fg-muted">
          {days > 0 ? `${formatDays(days)} excluding weekends and holidays.` : 'No working days in this range.'}
          {balance && !balance.unlimited && ` ${balance.available} available in ${balance.year}.`}
        </p>
        <Field label="Reason" error={reasonError} required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label="Attachment" hint="File name of a sick note or other document. Optional.">
          <Input value={attachment} onChange={(e) => setAttachment(e.target.value)} placeholder="medical-certificate.pdf" />
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
