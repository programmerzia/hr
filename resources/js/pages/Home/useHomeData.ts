import { useMemo } from 'react'
import type { BarDatum } from '../../components/charts/Bars'
import type { StackSegment } from '../../components/charts/StackedBar'
import { employees } from '../../mock/db/people'
import { scopeEmployees, todayKey, useAttendance } from '../../mock/stores/attendance'
import { usePeopleStore } from '../../mock/stores/people'
import type { Role } from '../../types'

/** Who the viewer sees in the presence overview: company for HR and management, otherwise their team. */
export function usePresenceScope(employeeId: string, role: Role) {
  const people = usePeopleStore((s) => s.employees)
  return useMemo(() => {
    if (role === 'hr' || role === 'management') return { people: scopeEmployees(employeeId, role), title: 'Company today' }
    const me = employees.find((e) => e.id === employeeId)
    const own = me?.team_id ? people.filter((e) => e.team_id === me.team_id && e.exited_on === null) : scopeEmployees(employeeId, role)
    return { people: own, title: 'Team today' }
  }, [employeeId, role, people])
}

/** Presence counts for a set of people, as StackedBar segments. */
export function usePresenceSegments(ids: string[]) {
  const now = useAttendance((s) => s.now)
  const days = useAttendance((s) => s.days)
  const presenceOf = useAttendance((s) => s.presenceOf)
  return useMemo(() => {
    const today = todayKey()
    const n = { working: 0, break: 0, offline: 0, leave: 0, ended: 0, notStarted: 0, absent: 0 }
    for (const id of ids) {
      const d = days.find((x) => x.employee_id === id && x.date === today)
      const st = d?.status ?? 'not_started'
      if (st === 'working') {
        if (presenceOf(id, now).offline) n.offline++
        else n.working++
      } else if (st === 'on_break') n.break++
      else if (st === 'on_leave') n.leave++
      else if (st === 'ended') n.ended++
      else if (st === 'absent') n.absent++
      else n.notStarted++
    }
    const segments: StackSegment[] = [
      { label: 'Working', value: n.working, color: 'success' },
      { label: 'On break', value: n.break, color: 'warning' },
      { label: 'Offline', value: n.offline, color: 'muted' },
      { label: 'On leave', value: n.leave, color: 'info' },
      { label: 'Day ended', value: n.ended, color: 'chart-7' },
      { label: 'Not started', value: n.notStarted, color: 'chart-3' },
      { label: 'Absent', value: n.absent, color: 'danger' },
    ]
    return { segments, total: ids.length, counts: n }
  }, [ids, days, presenceOf, now])
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Hires per month for the last N months, from joined_on dates. */
export function useHiresSeries(count = 6): { data: BarDatum[]; total: number } {
  const people = usePeopleStore((s) => s.employees)
  return useMemo(() => {
    const now = new Date()
    const data: BarDatum[] = Array.from({ length: count }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1)
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return {
        label: MONTHS[d.getMonth()] ?? prefix,
        values: [people.filter((p) => p.joined_on.startsWith(prefix)).length],
        active: i === count - 1 ? true : undefined,
      }
    })
    return { data, total: data.reduce((a, d) => a + (d.values[0] ?? 0), 0) }
  }, [people, count])
}
