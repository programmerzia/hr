import {
  Building2,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Clock,
  FileText,
  FolderKanban,
  History,
  House,
  Inbox,
  MessageSquare,
  Receipt,
  ReceiptText,
  Settings,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { NavGroupProp } from '../inertia/props'

/** Lucide icons by the name the server sends in `nav[].items[].icon` (App\Support\Nav). */
export const navIcons: Record<string, LucideIcon> = {
  Building2,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Clock,
  FileText,
  FolderKanban,
  History,
  House,
  Inbox,
  MessageSquare,
  Receipt,
  ReceiptText,
  Settings,
  UserRound,
  Users,
  Wallet,
}

export interface NavItem {
  id: string
  label: string
  to: string
  icon: LucideIcon
}

export interface VisibleGroup {
  id: string
  label?: string
  items: NavItem[]
}

/** Server nav (already filtered by role/employee) with icon names resolved. Unknown names fall back to a dot icon. */
export function navFromProps(nav: NavGroupProp[] | undefined): VisibleGroup[] {
  return (nav ?? [])
    .map((g) => ({
      id: g.id,
      label: g.label ?? undefined,
      items: g.items.map((i) => ({ ...i, icon: navIcons[i.icon] ?? House })),
    }))
    .filter((g) => g.items.length > 0)
}

export function flatNav(groups: VisibleGroup[]): NavItem[] {
  return groups.flatMap((g) => g.items)
}

/** Active when the path matches and no other visible item matches more specifically. */
export function isNavActive(pathname: string, item: NavItem, all: NavItem[]): boolean {
  const matches = (to: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`))
  if (!matches(item.to)) return false
  return !all.some((o) => o.to !== item.to && o.to.length > item.to.length && matches(o.to))
}

/** Items shown in the mobile tab bar, picked from the same config. */
export const mobileTabIds = ['home', 'my-day', 'tasks', 'chat'] as const

// ---- Legacy badge registry -------------------------------------------------
// Badges now come from the `badges` shared prop. The mock stores still register here until B3 deletes them;
// nothing reads the registry any more.
type BadgeFn = () => number

const badgeFns = new Map<string, BadgeFn>()
const badgeListeners = new Set<() => void>()
let badgeVersion = 0

export const navBadges = {
  set(id: string, fn: BadgeFn) {
    badgeFns.set(id, fn)
    badgeVersion++
    badgeListeners.forEach((l) => l())
  },
  get(id: string): BadgeFn | undefined {
    return badgeFns.get(id)
  },
  subscribe(listener: () => void) {
    badgeListeners.add(listener)
    return () => {
      badgeListeners.delete(listener)
    }
  },
  version: () => badgeVersion,
}
