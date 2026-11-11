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
import type { Employee, Role } from '../types'

export interface NavItem {
  id: string
  label: string
  to: string
  icon: LucideIcon
  /** Role filter. Omitted = every role. */
  roles?: Role[]
  /** Extra per-employee predicate, applied after `roles`. */
  visible?: (employee: Employee, role: Role) => boolean
}

export interface NavGroup {
  id: string
  /** Omitted = no heading. */
  label?: string
  roles?: Role[]
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { id: 'home', label: 'Home', to: '/', icon: House },
      { id: 'my-day', label: 'My day', to: '/my-day', icon: Clock },
      { id: 'tasks', label: 'My tasks', to: '/tasks', icon: CheckSquare },
      { id: 'projects', label: 'Projects', to: '/projects', icon: FolderKanban },
      { id: 'leave', label: 'Leave', to: '/leave', icon: CalendarDays },
      {
        id: 'payslips',
        label: 'Payslips',
        to: '/payslips',
        icon: ReceiptText,
        visible: (e) => e.employment_type === 'full_time',
      },
      {
        id: 'my-claims',
        label: 'Claims',
        to: '/claims',
        icon: Receipt,
        visible: (e, role) => e.employment_type === 'contractor' && role !== 'management',
      },
      { id: 'chat', label: 'Chat', to: '/chat', icon: MessageSquare },
      { id: 'inbox', label: 'Inbox', to: '/inbox', icon: Inbox },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    roles: ['team_lead', 'hr', 'management'],
    items: [
      { id: 'team', label: 'Team', to: '/team', icon: Users },
      { id: 'team-history', label: 'History', to: '/team/history', icon: History },
      { id: 'regularizations', label: 'Regularizations', to: '/team/regularizations', icon: ClipboardCheck },
      { id: 'leave-approvals', label: 'Leave approvals', to: '/leave/approvals', icon: CalendarCheck },
      { id: 'leave-calendar', label: 'Calendar', to: '/leave/calendar', icon: Calendar },
      { id: 'claims', label: 'Claims', to: '/claims', icon: Receipt, roles: ['team_lead'] },
    ],
  },
  {
    id: 'people-pay',
    label: 'People & pay',
    roles: ['hr', 'management'],
    items: [
      { id: 'people', label: 'People', to: '/people', icon: UserRound },
      { id: 'payroll', label: 'Payroll', to: '/payroll', icon: Wallet },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    roles: ['management'],
    items: [
      { id: 'clients', label: 'Clients', to: '/clients', icon: Building2 },
      { id: 'invoices', label: 'Invoices', to: '/invoices', icon: FileText },
      { id: 'claims', label: 'Claims', to: '/claims', icon: Receipt },
    ],
  },
  {
    id: 'admin',
    roles: ['hr', 'management'],
    items: [{ id: 'settings', label: 'Settings', to: '/settings', icon: Settings }],
  },
]

export interface VisibleGroup {
  id: string
  label?: string
  items: NavItem[]
}

/** Groups and items the given person may see. Empty groups are dropped. */
export function navFor(role: Role, employee: Employee): VisibleGroup[] {
  return navGroups
    .filter((g) => !g.roles || g.roles.includes(role))
    .map((g) => ({
      id: g.id,
      label: g.label,
      items: g.items.filter(
        (i) => (!i.roles || i.roles.includes(role)) && (!i.visible || i.visible(employee, role)),
      ),
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

// ---- Badge registry --------------------------------------------------------
// Other modules register real counts: navBadges.set('inbox', () => useInboxStore((s) => s.unread))
// The function runs during render of a per-item component, so it may use zustand hooks.
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
