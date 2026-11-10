import * as RDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from './IconButton'

export const DialogRoot = RDialog.Root
export const DialogTrigger = RDialog.Trigger
export const DialogClose = RDialog.Close

const overlay = 'fixed inset-0 z-40 bg-fg/40'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  className?: string
}

/** Centered modal. Primary action goes bottom-right of `footer`, cancel to its left as ghost. */
export function Dialog({ open, onOpenChange, title, description, children, footer, className }: DialogProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className={overlay} />
        <RDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-surface shadow-float focus-visible:outline-none',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
            <div>
              <RDialog.Title className="text-lg font-semibold">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-1 text-sm text-fg-muted">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{title}</RDialog.Description>
              )}
            </div>
            <RDialog.Close asChild>
              <IconButton label="Close" size="sm">
                <X size={16} />
              </IconButton>
            </RDialog.Close>
          </div>
          {children && <div className="overflow-y-auto px-4 py-2">{children}</div>}
          {footer && <div className="flex items-center justify-end gap-2 px-4 pb-4 pt-3">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}
