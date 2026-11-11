import { format } from 'date-fns'
import { Link } from 'react-router'
import { Ring } from '../../components/charts/Ring'
import { PageHeader } from '../../components/shared/PageHeader'
import { formatDuration } from '../../lib/format'
import { useAuthed } from '../../mock/session'
import { useTodayProgress } from '../Attendance/useAttendanceSeries'
import { ChatCard, LeaveBalancesCard, MyTasksCard } from './EmployeeCards'
import { AttentionCard, BillingCard, HiringCard, OverviewCard, PayrollCard, TeamNowCard } from './ManagerCards'

function greeting(hour: number): string {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

function TodayRing({ employeeId }: { employeeId: string }) {
  const { workSeconds, target, pct } = useTodayProgress(employeeId)
  return (
    <Link
      to="/my-day"
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

export function HomePage() {
  const { employee, role } = useAuthed()
  const now = new Date()
  const first = employee.name.split(' ')[0]
  const isManager = role !== 'employee'
  const isHr = role === 'hr' || role === 'management'

  return (
    <div className="mx-auto max-w-content space-y-6">
      <PageHeader
        title={`${greeting(now.getHours())}, ${first}`}
        description={format(now, 'EEEE d MMMM yyyy')}
        className="mb-0"
        actions={<TodayRing employeeId={employee.id} />}
      />

      <OverviewCard employeeId={employee.id} role={role} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {isManager && <TeamNowCard employeeId={employee.id} role={role} />}
          <MyTasksCard />
          {isHr && <PayrollCard />}
        </div>
        <div className="space-y-6">
          {isManager && <AttentionCard role={role} />}
          {role === 'management' && <BillingCard />}
          <LeaveBalancesCard employeeId={employee.id} />
          {isHr && <HiringCard />}
          <ChatCard employeeId={employee.id} />
        </div>
      </div>
    </div>
  )
}
