import { ChevronsUpDown, LogOut, Moon, Sun } from 'lucide-react'
import { useTheme } from '../app/theme'
import { cn } from '../lib/cn'
import { useAuthed } from '../mock/session'
import {
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui'

const roleLabel = { employee: 'Employee', team_lead: 'Team lead', hr: 'HR', management: 'Management' } as const

export function UserMenu({
  collapsed,
  onSignOut,
  side = 'top',
}: {
  collapsed?: boolean
  onSignOut: () => void
  side?: 'top' | 'right'
}) {
  const { employee, role } = useAuthed()
  const { theme, toggle } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={cn(
          'flex w-full items-center gap-2 rounded p-1.5 text-left transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          collapsed && 'justify-center',
        )}
      >
        <Avatar name={employee.name} size="md" />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-medium">{employee.name}</span>
              <span className="block truncate text-xs text-fg-muted">{roleLabel[role]}</span>
            </span>
            <ChevronsUpDown size={14} className="text-fg-subtle" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="start">
        <DropdownMenuItem onSelect={toggle}>
          {theme === 'dark' ? <Sun /> : <Moon />}
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
