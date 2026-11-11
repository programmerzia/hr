import { Navigate, Outlet, useLocation, useMatches } from 'react-router'
import { NoAccess } from '../pages/Auth/NoAccess'
import { useSession } from '../mock/session'
import { usePeopleStore } from '../mock/stores/people'
import type { Employee, Role } from '../types'

/** Route `handle`. Allowed when the role is listed OR `allow` returns true. Neither set = open to everyone. */
export interface RouteHandle {
  roles?: Role[]
  allow?: (who: { role: Role; employee: Employee }) => boolean
  /** Render the page without the sidebar or tab bar (print views). */
  bare?: boolean
}

export const fullTimeOnly: RouteHandle = {
  allow: ({ employee }) => employee.employment_type === 'full_time',
}

/** Sends signed-out visitors to /login. */
export function RequireAuth() {
  const signedIn = useSession((s) => s.employee !== null)
  const location = useLocation()
  if (!signedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Renders the plain "no access" page when the matched route's handle rejects the current person. */
export function RoleGuard() {
  const matches = useMatches()
  const role = useSession((s) => s.role)
  const employee = useSession((s) => s.employee)
  const userId = useSession((s) => s.user?.id)
  const mustChange = usePeopleStore((s) => s.users.find((u) => u.id === userId)?.must_change_password ?? false)
  const { pathname } = useLocation()
  if (!role || !employee) return null
  // A temporary password locks the app to the change form until it is replaced.
  if (mustChange && pathname !== '/account/password') return <Navigate to="/account/password" replace />

  const allowed = matches.every((m) => {
    const h = m.handle as RouteHandle | undefined
    if (!h || (!h.roles && !h.allow)) return true
    return Boolean(h.roles?.includes(role)) || Boolean(h.allow?.({ role, employee }))
  })
  return allowed ? <Outlet /> : <NoAccess />
}
