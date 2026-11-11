import { Bell, LogOut, Menu, Moon, Search, Settings, Sun, UserRound } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { usePageTitle } from '../app/pageTitle'
import { flatNav, isNavActive, type VisibleGroup } from '../app/nav'
import { useTheme } from '../app/theme'
import { Logomark } from '../components/shared/Logomark'
import {
  Avatar,
  Breadcrumb,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Kbd,
  Tooltip,
} from '../components/ui'
import { useAuthed } from '../mock/session'
import { NavBadge } from './NavList'
import { WorkStatusChip } from './WorkStatusChip'

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
const roleLabel = { employee: 'Employee', team_lead: 'Team lead', hr: 'HR', management: 'Management' } as const

interface TopBarProps {
  groups: VisibleGroup[]
  onOpenPalette: () => void
  onOpenMenu: () => void
  onSignOut: () => void
}

export function TopBar({ groups, onOpenPalette, onOpenMenu, onSignOut }: TopBarProps) {
  const { employee, role } = useAuthed()
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const crumbs = usePageTitle((s) => s.crumbs)

  const all = flatNav(groups)
  const active = all.find((i) => isNavActive(pathname, i, all))
  const items = crumbs ?? (active ? [{ label: active.label }] : [])
  const canProfile = role === 'hr' || role === 'management'

  return (
    <header
      data-testid="topbar"
      className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 md:px-6"
    >
      <Link to="/" aria-label="Vivacom home" className="flex items-center rounded md:hidden">
        <Logomark />
      </Link>

      <div className="hidden min-w-0 md:block md:w-56 lg:w-72 xl:w-80">
        {items.length > 0 && <Breadcrumb items={items} className="mb-0 truncate text-base" />}
      </div>

      <button
        type="button"
        onClick={onOpenPalette}
        className="hidden h-8 min-w-0 max-w-sm flex-1 items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 text-base text-fg-subtle transition-colors duration-150 hover:border-border-strong hover:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:flex"
      >
        <Search size={16} aria-hidden />
        <span className="flex-1 text-left">Search</span>
        <Kbd>{isMac ? '⌘K' : 'Ctrl K'}</Kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <WorkStatusChip />

        <div className="hidden items-center gap-0.5 md:flex">
          <Tooltip content="Inbox">
            <Link
              to="/inbox"
              aria-label="Inbox"
              className="relative inline-flex size-8 items-center justify-center rounded text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <Bell size={16} />
              <NavBadge id="inbox" className="absolute -right-0.5 -top-0.5" />
            </Link>
          </Tooltip>
          <IconButton label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggle}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </IconButton>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account menu"
              className="ml-1 rounded-full transition-shadow duration-150 hover:ring-2 hover:ring-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <Avatar name={employee.name} size="md" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <div className="flex items-center gap-2 px-2 py-2">
                <Avatar name={employee.name} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-base font-medium">{employee.name}</p>
                  <p className="truncate text-xs text-fg-muted">{roleLabel[role]}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              {canProfile && (
                <DropdownMenuItem onSelect={() => navigate(`/people/${employee.id}`)}>
                  <UserRound />
                  Profile
                </DropdownMenuItem>
              )}
              <DropdownMenuLabel className="sr-only">Account</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => navigate('/account')}>
                <Settings />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onSignOut}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <IconButton label="Open menu" onClick={onOpenMenu} className="md:hidden">
          <Menu size={20} />
        </IconButton>
      </div>
    </header>
  )
}
