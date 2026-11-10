import * as RPopover from '@radix-ui/react-popover'
import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/cn'

export const Popover = RPopover.Root
export const PopoverTrigger = RPopover.Trigger
export const PopoverClose = RPopover.Close

export const PopoverContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof RPopover.Content>>(
  function PopoverContent({ className, sideOffset = 4, align = 'start', ...props }, ref) {
    return (
      <RPopover.Portal>
        <RPopover.Content
          ref={ref}
          sideOffset={sideOffset}
          align={align}
          className={cn(
            'z-50 w-72 rounded-md border border-border bg-surface p-3 shadow-float focus-visible:outline-none',
            className,
          )}
          {...props}
        />
      </RPopover.Portal>
    )
  },
)
