import { Link } from '@inertiajs/react'
import { useCan, usePathname } from '../../inertia/props'
import { cn } from '../../lib/cn'

const tabs = [
  { name: 'settings.attendance.index', label: 'Attendance' },
  { name: 'settings.payroll.index', label: 'Payroll' },
  { name: 'settings.leave-types.index', label: 'Leave types' },
  { name: 'settings.holidays.index', label: 'Holidays' },
]

/** Link row shown under every Settings page title. */
export function SettingsTabs() {
  const canAccess = useCan('manage_access')
  const pathname = usePathname()
  return (
    <nav aria-label="Settings sections" className="flex gap-1 border-b border-border">
      {tabs.map((t) => {
        const active = route().current(t.name)
        return (
          <Link
            key={t.name}
            href={route(t.name)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              active ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {t.label}
          </Link>
        )
      })}
      {canAccess && (
        <Link
          href="/settings/access"
          aria-current={pathname.startsWith('/settings/access') ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            pathname.startsWith('/settings/access') ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg',
          )}
        >
          Access
        </Link>
      )}
    </nav>
  )
}
