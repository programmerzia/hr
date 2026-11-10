import { Bell, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { Link } from 'react-router'
import type { VisibleGroup } from '../app/nav'
import { Kbd, IconButton, Tooltip } from '../components/ui'
import { cn } from '../lib/cn'
import { NavBadge, NavList } from './NavList'
import { UserMenu } from './UserMenu'

interface SidebarProps {
  groups: VisibleGroup[]
  collapsed: boolean
  onToggleCollapsed: () => void
  onOpenPalette: () => void
  onSignOut: () => void
}

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)

export function Sidebar({ groups, collapsed, onToggleCollapsed, onOpenPalette, onSignOut }: SidebarProps) {
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface md:flex',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      <div className={cn('flex h-12 items-center gap-1 px-3', collapsed ? 'justify-center px-0' : 'justify-between')}>
        {!collapsed && <span className="text-lg font-semibold">Vivacom</span>}
        <div className="flex items-center gap-0.5">
          {!collapsed && (
            <Tooltip content="Inbox">
              <Link
                to="/inbox"
                aria-label="Inbox"
                className="relative inline-flex size-8 items-center justify-center rounded text-fg-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <Bell size={16} />
                <NavBadge id="inbox" className="absolute -right-0.5 -top-0.5" />
              </Link>
            </Tooltip>
          )}
          <IconButton label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={onToggleCollapsed}>
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </IconButton>
        </div>
      </div>

      <div className="px-2 pb-3">
        {collapsed ? (
          <IconButton label="Search" onClick={onOpenPalette} className="w-full">
            <Search size={16} />
          </IconButton>
        ) : (
          <button
            type="button"
            onClick={onOpenPalette}
            className="flex h-8 w-full items-center gap-2 rounded border border-border-strong bg-surface px-2 text-base text-fg-subtle transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Search size={16} aria-hidden />
            <span className="flex-1 text-left">Search</span>
            <Kbd>{isMac ? '⌘K' : 'Ctrl K'}</Kbd>
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <NavList groups={groups} collapsed={collapsed} />
      </div>

      <div className="border-t border-border p-2">
        <UserMenu collapsed={collapsed} onSignOut={onSignOut} />
      </div>
    </aside>
  )
}
