import * as RSelect from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { fieldClass } from './Input'

export interface SelectOption {
  value: string // must not be an empty string
  label: string
}

interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

/** Radix select with a styled popover list. Use NativeSelect for simple forms and mobile. */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select',
  disabled,
  className,
  id,
  ...aria
}: SelectProps) {
  return (
    <RSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RSelect.Trigger
        id={id}
        className={cn(
          fieldClass,
          'inline-flex h-8 items-center justify-between gap-2 text-left data-[placeholder]:text-fg-subtle',
          className,
        )}
        {...aria}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon>
          <ChevronDown size={16} className="text-fg-subtle" />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-surface shadow-float"
        >
          <RSelect.Viewport className="p-1">
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                className="relative flex h-8 cursor-default select-none items-center rounded pl-7 pr-2 text-base text-fg outline-none data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50"
              >
                <RSelect.ItemIndicator className="absolute left-2">
                  <Check size={14} />
                </RSelect.ItemIndicator>
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  )
}

export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function NativeSelect({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select ref={ref} className={cn(fieldClass, 'h-8 appearance-none pr-8', className)} {...props}>
          {children}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle"
          aria-hidden
        />
      </div>
    )
  },
)
