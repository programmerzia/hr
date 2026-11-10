import { Navigate, Outlet, useLocation, useMatches } from 'react-router'
import { NoAccess } from '../pages/Auth/NoAccess'
import { useSession } from '../mock/session'
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
  if (!role || !employee) return null

  const allowed = matches.every((m) => {
    const h = m.handle as RouteHandle | undefined
    if (!h || (!h.roles && !h.allow)) return true
    return Boolean(h.roles?.includes(role)) || Boolean(h.allow?.({ role, employee }))
  })
  return allowed ? <Outlet /> : <NoAccess />
}
