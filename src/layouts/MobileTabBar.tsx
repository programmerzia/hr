import { Menu } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { flatNav, isNavActive, mobileTabIds, type VisibleGroup } from '../app/nav'
import { Sheet } from '../components/ui'
import { cn } from '../lib/cn'
import { NavBadge, NavList } from './NavList'
import { UserMenu } from './UserMenu'

export function MobileTabBar({ groups, onSignOut }: { groups: VisibleGroup[]; onSignOut: () => void }) {
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const all = flatNav(groups)
  const tabs = mobileTabIds.map((id) => all.find((i) => i.id === id)).filter((i) => i !== undefined)
  const tabClass =
    'relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40'

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface md:hidden"
      >
        {tabs.map((item) => {
          const active = isNavActive(pathname, item, all)
          const Icon = item.icon
          return (
            <Link
              key={item.id}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={cn(tabClass, active ? 'font-medium text-accent' : 'text-fg-muted')}
            >
              <Icon size={20} aria-hidden />
              {item.label}
              <NavBadge id={item.id} className="absolute right-1/4 top-1.5" />
            </Link>
          )
        })}
        <button type="button" onClick={() => setMoreOpen(true)} className={cn(tabClass, 'text-fg-muted')}>
          <Menu size={20} aria-hidden />
          More
        </button>
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title="Menu" side="left">
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-2">
            <NavList groups={groups} onNavigate={() => setMoreOpen(false)} />
          </div>
          <div className="border-t border-border p-2">
            <UserMenu
              side="top"
              onSignOut={() => {
                setMoreOpen(false)
                onSignOut()
              }}
            />
          </div>
        </div>
      </Sheet>
    </>
  )
}
