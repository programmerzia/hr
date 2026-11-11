import { LogOut, Menu, Moon, Sun } from 'lucide-react'
import { Link } from '@inertiajs/react'
import { flatNav, isNavActive, mobileTabIds, type VisibleGroup } from '../app/nav'
import { useTheme } from '../app/theme'
import { Avatar, Button, Sheet } from '../components/ui'
import { useAuth, usePathname } from '../inertia/props'
import { cn } from '../lib/cn'
import { NavBadge, NavList } from './NavList'

export function MobileTabBar({
  groups,
  menuOpen,
  onMenuOpenChange,
  onSignOut,
}: {
  groups: VisibleGroup[]
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  onSignOut: () => void
}) {
  const { employee } = useAuth()
  const { theme, toggle } = useTheme()
  const pathname = usePathname()
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
              href={item.to}
              aria-current={active ? 'page' : undefined}
              className={cn(tabClass, active ? 'font-medium text-accent' : 'text-fg-muted')}
            >
              <Icon size={20} aria-hidden />
              {item.label}
              <NavBadge id={item.id} className="absolute right-1/4 top-1.5" />
            </Link>
          )
        })}
        <button type="button" onClick={() => onMenuOpenChange(true)} className={cn(tabClass, 'text-fg-muted')}>
          <Menu size={20} aria-hidden />
          More
        </button>
      </nav>
      <Sheet open={menuOpen} onOpenChange={onMenuOpenChange} title="Menu" side="left">
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-2">
            <NavList groups={groups} onNavigate={() => onMenuOpenChange(false)} />
          </div>
          <div className="flex flex-col gap-2 border-t border-border p-3">
            <div className="flex items-center gap-2">
              <Avatar name={employee.name} size="md" />
              <span className="min-w-0 flex-1 truncate text-base font-medium">{employee.name}</span>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" icon={theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} onClick={toggle}>
                {theme === 'dark' ? 'Light theme' : 'Dark theme'}
              </Button>
              <Button
                className="flex-1"
                icon={<LogOut size={16} />}
                onClick={() => {
                  onMenuOpenChange(false)
                  onSignOut()
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </Sheet>
    </>
  )
}
