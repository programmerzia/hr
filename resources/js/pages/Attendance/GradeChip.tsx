import { Badge } from '../../components/ui'
import type { AttendanceDay } from '../../types'
import { dayGrade } from './lib'

/** Day grade chip (Full / Half day / Absent / Excused / leave); a dash for weekends, holidays and ungraded days. */
export function GradeChip({ day }: { day: AttendanceDay | null | undefined }) {
  const g = dayGrade(day)
  return g ? <Badge variant={g.variant}>{g.label}</Badge> : <span className="text-fg-subtle">-</span>
}
