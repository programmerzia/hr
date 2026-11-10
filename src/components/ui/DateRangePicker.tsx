import { endOfMonth, format, startOfMonth, startOfWeek, endOfWeek, subDays, subMonths } from 'date-fns'
import { cn } from '../../lib/cn'
import { Button } from './Button'
import { Input } from './Input'

export interface DateRange {
  from: string // yyyy-MM-dd
  to: string
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

interface DateRangePickerProps {
  value: DateRange
  onChange: (value: DateRange) => void
  className?: string
}

/** Two date inputs plus quick presets. */
export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const now = new Date()
  const presets: { label: string; range: DateRange }[] = [
    { label: 'This week', range: { from: iso(startOfWeek(now)), to: iso(endOfWeek(now)) } },
    { label: 'Last 7 days', range: { from: iso(subDays(now, 6)), to: iso(now) } },
    { label: 'This month', range: { from: iso(startOfMonth(now)), to: iso(endOfMonth(now)) } },
    {
      label: 'Last month',
      range: { from: iso(startOfMonth(subMonths(now, 1))), to: iso(endOfMonth(subMonths(now, 1))) },
    },
  ]
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Input
        type="date"
        aria-label="From date"
        value={value.from}
        max={value.to}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        className="w-36"
      />
      <span className="text-fg-subtle" aria-hidden>
        to
      </span>
      <Input
        type="date"
        aria-label="To date"
        value={value.to}
        min={value.from}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        className="w-36"
      />
      {presets.map((p) => (
        <Button key={p.label} size="sm" variant="ghost" onClick={() => onChange(p.range)}>
          {p.label}
        </Button>
      ))}
    </div>
  )
}
