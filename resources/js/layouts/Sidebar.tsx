import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Link } from '@inertiajs/react'
import type { VisibleGroup } from '../app/nav'
import { Logomark } from '../components/shared/Logomark'
import { cn } from '../lib/cn'
import { NavList } from './NavList'

interface SidebarProps {
  groups: VisibleGroup[]
  collapsed: boolean
  onToggleCollapsed: () => void
}

/** Navigation only: logomark and name, groups, collapse toggle. Search, inbox and the account live in the top bar. */
export function Sidebar({ groups, collapsed, onToggleCollapsed }: SidebarProps) {
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar md:flex',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      <Link
        href="/"
        aria-label="Vivacom home"
        className={cn(
          'flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40',
          collapsed && 'justify-center px-0',
        )}
      >
        <Logomark />
        {!collapsed && <span className="text-lg font-semibold tracking-tight">Vivacom</span>}
      </Link>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <NavList groups={groups} collapsed={collapsed} />
      </div>

      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex h-8 w-full items-center gap-2 rounded px-2 text-base text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
