import { Link } from '@inertiajs/react'
import { CalendarDays, Clock, Palmtree, Wallet } from 'lucide-react'
import { HistoryPanel } from '../../components/shared/HistoryPanel'
import { PageHeader } from '../../components/shared/PageHeader'
import { Card, CardBody } from '../../components/ui'
import { useShared } from '../../inertia/props'
import type { SettingsHistoryEntry } from '../../types'

const sections = [
  { name: 'settings.attendance.index', icon: Clock, title: 'Attendance', text: 'Shift hours, grace time, weekends and when a day counts as half or absent.' },
  { name: 'settings.payroll.index', icon: Wallet, title: 'Payroll', text: 'Which deductions apply: absences, lates, provident fund, tax and overtime.' },
  { name: 'settings.leave-types.index', icon: CalendarDays, title: 'Leave types', text: 'Yearly quotas, paid or unpaid, carry forward and encashment.' },
  { name: 'settings.holidays.index', icon: Palmtree, title: 'Holidays', text: 'The company holiday calendar by year.' },
]

export default function SettingsPage() {
  const { history } = useShared<{ history: SettingsHistoryEntry[] }>()
  return (
    <div className="mx-auto max-w-content">
      <PageHeader title="Settings" description="Company rules for attendance, pay and leave. Policy changes start on a date you choose." />
      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((s) => (
            <Link key={s.name} href={route(s.name)} className="block">
              <Card interactive className="h-full">
                <CardBody>
                  <s.icon size={20} className="text-fg-muted" aria-hidden />
                  <h2 className="mt-3 text-base font-semibold">{s.title}</h2>
                  <p className="mt-1 text-sm text-fg-muted">{s.text}</p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
        <HistoryPanel title="Recent changes" entries={history} />
      </div>
    </div>
  )
}
