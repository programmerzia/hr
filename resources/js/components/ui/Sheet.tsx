import * as RDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from './IconButton'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  side?: 'right' | 'left' | 'bottom'
  children?: ReactNode
  footer?: ReactNode
  className?: string
  /** Hide the visible title (kept for screen readers). */
  hideTitle?: boolean
}

const sides = {
  right: 'inset-y-0 right-0 h-full w-full max-w-lg border-l',
  left: 'inset-y-0 left-0 h-full w-72 max-w-[85vw] border-r',
  bottom: 'inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-lg border-t',
}

/** Side drawer. Used for quick views (task, attendance day) and the mobile nav sheet. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  side = 'right',
  children,
  footer,
  className,
  hideTitle,
}: SheetProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-fg/40" />
        <RDialog.Content
          className={cn(
            'fixed z-50 flex flex-col border-border bg-surface shadow-float focus-visible:outline-none',
            sides[side],
            className,
          )}
        >
          <div className={cn('flex items-start justify-between gap-3 border-b border-border px-4 py-3', hideTitle && 'sr-only')}>
            <div>
              <RDialog.Title className="text-lg font-semibold">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-0.5 text-sm text-fg-muted">{description}</RDialog.Description>
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
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}
