import { useId } from 'react'
import { cn } from '../../lib/cn'

export interface RadioOption {
  value: string
  label: string
  hint?: string
}

interface RadioGroupProps {
  value: string
  onValueChange: (value: string) => void
  options: RadioOption[]
  name?: string
  className?: string
  'aria-label'?: string
}

export function RadioGroup({ value, onValueChange, options, name, className, ...aria }: RadioGroupProps) {
  const auto = useId()
  const group = name ?? auto
  return (
    <div role="radiogroup" className={cn('flex flex-col gap-2', className)} {...aria}>
      {options.map((o) => (
        <label key={o.value} className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name={group}
            value={o.value}
            checked={value === o.value}
            onChange={() => onValueChange(o.value)}
            className="mt-0.5 size-4 shrink-0 accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <span className="text-base text-fg">
            {o.label}
            {o.hint && <span className="block text-xs text-fg-muted">{o.hint}</span>}
          </span>
        </label>
      ))}
    </div>
  )
}
