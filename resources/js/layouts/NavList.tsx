import { Link } from '@inertiajs/react'
import { flatNav, isNavActive, type NavItem, type VisibleGroup } from '../app/nav'
import { useShared, usePathname } from '../inertia/props'
import { cn } from '../lib/cn'
import { Tooltip } from '../components/ui'

/** Count from the `badges` shared prop for a nav item id. Renders nothing for zero. */
export function NavBadge({ id, className }: { id: string; className?: string }) {
  const count = useShared().badges?.[id] ?? 0
  if (count <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-xs font-medium text-accent-fg',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

interface NavListProps {
  groups: VisibleGroup[]
  collapsed?: boolean
  onNavigate?: () => void
}

export function NavList({ groups, collapsed, onNavigate }: NavListProps) {
  const pathname = usePathname()
  const all: NavItem[] = flatNav(groups)

  return (
    <nav aria-label="Main" className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.id}>
          {g.label && !collapsed && <p className="mb-1 px-2 text-xs font-medium text-fg-subtle">{g.label}</p>}
          {g.label && collapsed && <div className="mx-2 mb-1 border-t border-border" />}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const active = isNavActive(pathname, item, all)
              const Icon = item.icon
              const link = (
                <Link
                  href={item.to}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={cn(
                    'relative flex h-8 items-center gap-2 rounded px-2 text-base transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                    active
                      ? 'bg-accent-soft font-medium text-accent before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent'
                      : 'text-fg-muted hover:bg-surface hover:text-fg hover:shadow-xs',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  <Icon size={16} strokeWidth={1.75} className="shrink-0" aria-hidden />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  <NavBadge id={item.id} className={collapsed ? 'absolute right-0.5 top-0.5' : undefined} />
                </Link>
              )
              return (
                <li key={item.id}>
                  {collapsed ? (
                    <Tooltip content={item.label} side="right">
                      {link}
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
