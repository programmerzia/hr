import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { navFor } from '../app/nav'
import { CommandPalette, type CommandItem } from '../components/ui'
import { useAuthed } from '../mock/session'
import { LogoutDialog } from '../pages/Auth/LogoutDialog'
import { MobileTabBar } from './MobileTabBar'
import { Sidebar } from './Sidebar'
import { useHeartbeat } from './useHeartbeat'

const COLLAPSED_KEY = 'vivacom.sidebar_collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function AppLayout() {
  const { employee, role } = useAuthed()
  const navigate = useNavigate()
  useHeartbeat()

  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)

  const groups = useMemo(() => navFor(role, employee), [role, employee])

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
          onSelect: () => navigate(i.to),
        })),
      ),
    [groups, navigate],
  )

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar
        groups={groups}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        onOpenPalette={() => setPaletteOpen(true)}
        onSignOut={() => setLogoutOpen(true)}
      />
      <main className="min-w-0 flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-6 md:pt-6">
        <Outlet />
      </main>
      <MobileTabBar groups={groups} onSignOut={() => setLogoutOpen(true)} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={commands} />
      <LogoutDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
    </div>
  )
}
