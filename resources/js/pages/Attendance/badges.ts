import { navBadges } from '../../app/nav'
import { useSession } from '../../mock/session'
import { scopeEmployees, useAttendance } from '../../mock/stores/attendance'

/** Pending regularizations in the viewer's scope. Runs during render, so hooks are fine here. */
export function usePendingRegularizations(): number {
  const employee = useSession((s) => s.employee)
  const role = useSession((s) => s.role)
  const regs = useAttendance((s) => s.regularizations)
  if (!employee || !role || role === 'employee') return 0
  const ids = new Set(scopeEmployees(employee.id, role).map((e) => e.id))
  return regs.filter((r) => r.status === 'pending' && ids.has(r.employee_id) && r.employee_id !== employee.id).length
}

navBadges.set('regularizations', usePendingRegularizations)
