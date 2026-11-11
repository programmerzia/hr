import { Link } from '@inertiajs/react'
import { format } from 'date-fns'
import { Ring } from '../../components/charts/Ring'
import { PageHeader } from '../../components/shared/PageHeader'
import { useWorkSeconds } from '../../inertia/clock'
import { useAuth, useShared } from '../../inertia/props'
import { formatDuration } from '../../lib/format'

// The module wave adds Home props (team presence, tasks, leave balances, payroll, billing…) and ports
// EmployeeCards / ManagerCards to read them. Until then only the header and today's ring render.

function greeting(hour: number): string {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

function TodayRing() {
  const { attendance } = useShared()
  const workSeconds = useWorkSeconds(attendance)
  const target = (attendance?.policy?.standard_minutes ?? 480) * 60
  const pct = target > 0 ? Math.min(100, Math.round((workSeconds / target) * 100)) : 0
  return (
    <Link
      href="/my-day"
      className="group flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <div className="text-right">
        <p className="font-mono text-lg font-medium tabular-nums">{formatDuration(workSeconds)}</p>
        <p className="text-xs text-fg-muted group-hover:text-fg">of {formatDuration(target)} today</p>
      </div>
      <Ring value={pct} size={48} aria-label={`${pct}% of today's target worked`}>
        <span className="font-mono text-xs font-medium tabular-nums">{pct}%</span>
      </Ring>
    </Link>
  )
}

export default function HomePage() {
  const { employee } = useAuth()
  const now = new Date()
  const first = employee.name.split(' ')[0]

  return (
    <div className="mx-auto max-w-content space-y-6">
      <PageHeader
        title={`${greeting(now.getHours())}, ${first}`}
        description={format(now, 'EEEE d MMMM yyyy')}
        className="mb-0"
        actions={<TodayRing />}
      />
    </div>
  )
}
