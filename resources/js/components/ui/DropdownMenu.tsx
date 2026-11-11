import * as RMenu from '@radix-ui/react-dropdown-menu'
import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/cn'

export const DropdownMenu = RMenu.Root
export const DropdownMenuTrigger = RMenu.Trigger
export const DropdownMenuSub = RMenu.Sub

export const DropdownMenuContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof RMenu.Content>>(
  function DropdownMenuContent({ className, sideOffset = 4, ...props }, ref) {
    return (
      <RMenu.Portal>
        <RMenu.Content
          ref={ref}
          sideOffset={sideOffset}
          className={cn(
            'z-50 min-w-48 rounded-md border border-border bg-surface p-1 shadow-float',
            className,
          )}
          {...props}
        />
      </RMenu.Portal>
    )
  },
)

type ItemProps = ComponentPropsWithoutRef<typeof RMenu.Item> & { destructive?: boolean }

export const DropdownMenuItem = forwardRef<HTMLDivElement, ItemProps>(function DropdownMenuItem(
  { className, destructive, ...props },
  ref,
) {
  return (
    <RMenu.Item
      ref={ref}
      className={cn(
        'flex h-8 cursor-default select-none items-center gap-2 rounded px-2 text-base outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-fg-muted',
        destructive ? 'text-danger [&_svg]:text-danger' : 'text-fg',
        className,
      )}
      {...props}
    />
  )
})

export function DropdownMenuLabel({ className, ...props }: ComponentPropsWithoutRef<typeof RMenu.Label>) {
  return <RMenu.Label className={cn('px-2 py-1.5 text-xs text-fg-subtle', className)} {...props} />
}

export function DropdownMenuSeparator({ className, ...props }: ComponentPropsWithoutRef<typeof RMenu.Separator>) {
  return <RMenu.Separator className={cn('my-1 h-px bg-border', className)} {...props} />
}
