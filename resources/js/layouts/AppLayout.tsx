import { router } from '@inertiajs/react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { navFromProps } from '../app/nav'
import { CommandPalette, type CommandItem } from '../components/ui'
import { useShared, usePathname } from '../inertia/props'
import { FlashToasts } from '../inertia/FlashToasts'
import { Logomark } from '../components/shared/Logomark'
import { LogoutDialog } from '../pages/Auth/LogoutDialog'
import { MobileTabBar } from './MobileTabBar'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useHeartbeat } from './useHeartbeat'

const COLLAPSED_KEY = 'vivacom.sidebar_collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

/** Minimal shell shown while a temporary password must be replaced: no sidebar, no top bar. */
function LockedShell({ children }: { children: ReactNode }) {
  const [logoutOpen, setLogoutOpen] = useState(false)
  return (
    <div className="flex min-h-screen flex-col items-center bg-bg px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <Logomark size={28} />
        <span className="text-xl font-semibold">Vivacom</span>
      </div>
      <main className="w-full max-w-lg">
        {children}
      </main>
      <button type="button" className="mt-6 text-sm text-fg-muted underline hover:text-fg" onClick={() => setLogoutOpen(true)}>
        Sign out
      </button>
      <LogoutDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
    </div>
  )
}

/**
 * Persistent shell for every signed-in page (set by the page resolver in main.tsx, so it survives visits).
 * While `auth.user.must_change_password` is set the server only serves the account page; it gets the locked shell.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const mustChange = useShared().auth?.user.must_change_password ?? false
  return (
    <>
      <FlashToasts />
      {mustChange ? <LockedShell>{children}</LockedShell> : <AppShell>{children}</AppShell>}
    </>
  )
}

/** Print views: no sidebar or top bar. Pages opt in with `Page.layout = BareLayout`. */
export function BareLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-bg px-4 py-6 print:p-0">
      <FlashToasts />
      {children}
    </main>
  )
}

function AppShell({ children }: { children: ReactNode }) {
  const { nav } = useShared()
  const pathname = usePathname()
  useHeartbeat()

  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const groups = useMemo(() => navFromProps(nav), [nav])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1')
      } catch {
        // ignore
      }
      return !c
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const commands = useMemo<CommandItem[]>(
    () =>
      groups.flatMap((g) =>
        g.items.map((i) => ({
          id: i.id,
          label: i.label,
          group: g.label,
          icon: i.icon,
          onSelect: () => router.visit(i.to),
        })),
      ),
    [groups],
  )

  return (
    <div className="flex min-h-screen bg-bg [--sticky-top:48px]">
      <Sidebar groups={groups} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          groups={groups}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenMenu={() => setMenuOpen(true)}
          onSignOut={() => setLogoutOpen(true)}
        />
        <main
          key={pathname}
          className="page-enter mx-auto w-full max-w-content flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-8 md:pt-6"
        >
          {children}
        </main>
      </div>
      <MobileTabBar
        groups={groups}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        onSignOut={() => setLogoutOpen(true)}
      />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={commands} />
      <LogoutDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
    </div>
  )
}
