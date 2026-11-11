import * as RDialog from '@radix-ui/react-dialog'
import { CornerDownLeft, Search } from 'lucide-react'
import { useMemo, useState, type ComponentType } from 'react'
import { cn } from '../../lib/cn'
import { Kbd } from './Kbd'

export interface CommandItem {
  id: string
  label: string
  group?: string
  icon?: ComponentType<{ size?: number; className?: string }>
  onSelect: () => void
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CommandItem[]
}

export function CommandPalette({ open, onOpenChange, items }: CommandPaletteProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-fg/40" />
        <RDialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[15vh] z-50 w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-surface shadow-float focus-visible:outline-none"
        >
          <RDialog.Title className="sr-only">Command palette</RDialog.Title>
          <PaletteBody items={items} onClose={() => onOpenChange(false)} />
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/** Mounted only while open, so query and selection reset on every open. */
function PaletteBody({ items, onClose }: { items: CommandItem[]; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items
  }, [items, query])

  const run = (item: CommandItem | undefined) => {
    if (!item) return
    onClose()
    item.onSelect()
  }

  return (
    <>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search size={16} className="text-fg-subtle" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActive((a) => Math.min(a + 1, filtered.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActive((a) => Math.max(a - 1, 0))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  run(filtered[active])
                }
              }}
              placeholder="Go to a page"
              aria-label="Search pages"
              className="h-11 flex-1 bg-transparent text-base text-fg placeholder:text-fg-subtle focus-visible:outline-none"
            />
            <Kbd>Esc</Kbd>
          </div>
          <ul role="listbox" className="max-h-80 overflow-y-auto p-1">
            {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-fg-muted">No matches</li>}
            {filtered.map((item, i) => {
              const Icon = item.icon
              return (
                <li
                  key={item.id}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(item)}
                  className={cn(
                    'flex h-8 cursor-default items-center gap-2 rounded px-2 text-base',
                    i === active ? 'bg-surface-2' : '',
                  )}
                >
                  {Icon && <Icon size={16} className="text-fg-muted" />}
                  <span className="flex-1">{item.label}</span>
                  {item.group && <span className="text-xs text-fg-subtle">{item.group}</span>}
                  {i === active && <CornerDownLeft size={14} className="text-fg-subtle" aria-hidden />}
                </li>
              )
            })}
          </ul>
    </>
  )
}
