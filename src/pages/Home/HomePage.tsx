import { format } from 'date-fns'
import { PageHeader } from '../../components/shared/PageHeader'
import { useAuthed } from '../../mock/session'
import { ChatCard, LeaveBalancesCard, MyTasksCard, TodayCard } from './EmployeeCards'
import { AttentionCard, CompanyStats, FinanceStats, PayrollCard, PeopleStats, TeamNowCard } from './ManagerCards'

function greeting(hour: number): string {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

export function HomePage() {
  const { employee, role } = useAuthed()
  const now = new Date()
  const first = employee.name.split(' ')[0]
  const isManager = role !== 'employee'
  const isHr = role === 'hr' || role === 'management'

  return (
    <div className="mx-auto max-w-content space-y-4">
      <PageHeader title={`${greeting(now.getHours())}, ${first}`} description={format(now, 'EEEE d MMMM yyyy')} className="mb-0" />

      {role === 'management' && <CompanyStats />}
      {isHr && <PeopleStats />}
      {role === 'management' && <FinanceStats />}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <TodayCard employeeId={employee.id} />
          {isManager && <TeamNowCard employeeId={employee.id} role={role} />}
          <MyTasksCard />
        </div>
        <div className="space-y-4">
          {isManager && <AttentionCard />}
          {isHr && <PayrollCard />}
          <LeaveBalancesCard employeeId={employee.id} />
          <ChatCard employeeId={employee.id} />
        </div>
      </div>
    </div>
  )
}
