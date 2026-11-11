import { usePage } from '@inertiajs/react'
import type {
  Ability,
  AttendanceDay,
  AttendancePolicy,
  Employee,
  ISODateTime,
  Role,
  TimeSegment,
  User,
} from '../types'

/** One nav entry as HandleInertiaRequests sends it. `icon` is a lucide name looked up in app/nav.ts `navIcons`. */
export interface NavItemProp {
  id: string
  label: string
  to: string
  icon: string
}

export interface NavGroupProp {
  id: string
  label?: string | null
  items: NavItemProp[]
}

export interface AuthProp {
  user: User
  employee: Employee
  role: Role
  abilities: Ability[]
}

export interface AttendanceProp {
  day: AttendanceDay | null
  open_segment: TimeSegment | null
  policy: AttendancePolicy
  server_time: ISODateTime
}

/** Shared props on every Inertia response (docs/06-backend-plan.md). Pages extend this with their own props. */
export interface SharedProps {
  auth: AuthProp | null
  nav: NavGroupProp[]
  badges: Record<string, number>
  attendance: AttendanceProp
  flash: { success?: string; error?: string }
  ziggy: { url: string; port: number | null; defaults: Record<string, unknown>; routes: Record<string, unknown>; location?: string }
  /** Dev only: demo accounts listed on the login page. */
  demo_accounts?: { name: string; email: string; role: Role; caption?: string }[]
  [key: string]: unknown
}

/** All shared props plus the page's own props. */
export function useShared<P extends object = object>(): SharedProps & P {
  return usePage<SharedProps & P>().props
}

/** Signed-in viewer. Only call under AppLayout / authenticated pages; throws when auth is null. */
export function useAuth(): AuthProp {
  const auth = usePage<SharedProps>().props.auth
  if (!auth) throw new Error('useAuth() called on a page without a signed-in user')
  return auth
}

export function useCan(ability: Ability): boolean {
  return usePage<SharedProps>().props.auth?.abilities.includes(ability) ?? false
}

/** Current path without the query string, e.g. '/leave/approvals'. */
export function usePathname(): string {
  return usePage().url.split('?')[0] || '/'
}
