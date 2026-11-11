import * as RTabs from '@radix-ui/react-tabs'
import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/cn'

export const Tabs = RTabs.Root

export const TabsList = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof RTabs.List>>(
  function TabsList({ className, ...props }, ref) {
    return (
      <RTabs.List
        ref={ref}
        className={cn('flex gap-4 overflow-x-auto border-b border-border', className)}
        {...props}
      />
    )
  },
)

export const TabsTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof RTabs.Trigger>>(
  function TabsTrigger({ className, ...props }, ref) {
    return (
      <RTabs.Trigger
        ref={ref}
        className={cn(
          '-mb-px h-9 whitespace-nowrap border-b-2 border-transparent text-base text-fg-muted transition-colors duration-150 hover:border-border-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=active]:border-accent data-[state=active]:font-medium hover:data-[state=active]:border-accent data-[state=active]:text-fg',
          className,
        )}
        {...props}
      />
    )
  },
)

export const TabsContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof RTabs.Content>>(
  function TabsContent({ className, ...props }, ref) {
    return (
      <RTabs.Content
        ref={ref}
        className={cn('pt-4 focus-visible:outline-none', className)}
        {...props}
      />
    )
  },
)
