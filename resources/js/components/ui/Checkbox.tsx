import * as RCheckbox from '@radix-ui/react-checkbox'
import * as RSwitch from '@radix-ui/react-switch'
import { Check, Minus } from 'lucide-react'
import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

type CheckboxProps = ComponentPropsWithoutRef<typeof RCheckbox.Root> & { label?: ReactNode }

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { className, label, id, ...props },
  ref,
) {
  const auto = useId()
  const cid = id ?? auto
  const box = (
    <RCheckbox.Root
      ref={ref}
      id={cid}
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded border border-border-strong bg-surface transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent',
        className,
      )}
      {...props}
    >
      <RCheckbox.Indicator className="text-accent-fg">
        {props.checked === 'indeterminate' ? <Minus size={12} /> : <Check size={12} />}
      </RCheckbox.Indicator>
    </RCheckbox.Root>
  )
  if (!label) return box
  return (
    <div className="flex items-center gap-2">
      {box}
      <label htmlFor={cid} className="text-base text-fg">
        {label}
      </label>
    </div>
  )
})

type SwitchProps = ComponentPropsWithoutRef<typeof RSwitch.Root> & { label?: ReactNode }

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { className, label, id, ...props },
  ref,
) {
  const auto = useId()
  const sid = id ?? auto
  const sw = (
    <RSwitch.Root
      ref={ref}
      id={sid}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full bg-border-strong transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 data-[state=checked]:bg-accent',
        className,
      )}
      {...props}
    >
      <RSwitch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-surface transition-transform duration-150 data-[state=checked]:translate-x-[18px]" />
    </RSwitch.Root>
  )
  if (!label) return sw
  return (
    <div className="flex items-center gap-2">
      {sw}
      <label htmlFor={sid} className="text-base text-fg">
        {label}
      </label>
    </div>
  )
})
