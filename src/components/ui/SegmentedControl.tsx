import { cn } from '../../lib/cn'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: SegmentOption<T>[]
  className?: string
  'aria-label'?: string
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
  ...aria
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      className={cn('inline-flex rounded border border-border-strong bg-surface-2 p-0.5', className)}
      {...aria}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onValueChange(o.value)}
          className={cn(
            'h-6 rounded-sm px-2.5 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            value === o.value ? 'bg-surface font-medium text-fg' : 'text-fg-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
