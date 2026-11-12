import { Link } from '@inertiajs/react'
import { CalendarDays, Clock, Palmtree, ShieldCheck, Wallet } from 'lucide-react'
import { HistoryPanel } from '../../components/shared/HistoryPanel'
import { PageHeader } from '../../components/shared/PageHeader'
import { Card, CardBody } from '../../components/ui'
import { useCan, useShared } from '../../inertia/props'
import type { SettingsHistoryEntry } from '../../types'

const sections: { name?: string; href?: string; icon: typeof Clock; title: string; text: string; ability?: 'manage_access' | 'manage_policy' }[] = [
  { name: 'settings.attendance.index', icon: Clock, title: 'Attendance', text: 'Shift hours, grace time, weekends and when a day counts as half or absent.', ability: 'manage_policy' },
  { name: 'settings.payroll.index', icon: Wallet, title: 'Payroll', text: 'Which deductions apply: absences, lates, provident fund, tax and overtime.', ability: 'manage_policy' },
  { name: 'settings.leave-types.index', icon: CalendarDays, title: 'Leave types', text: 'Yearly quotas, paid or unpaid, carry forward and encashment.', ability: 'manage_policy' },
  { name: 'settings.holidays.index', icon: Palmtree, title: 'Holidays', text: 'The company holiday calendar by year.', ability: 'manage_policy' },
  { href: '/settings/access', icon: ShieldCheck, title: 'Access', text: 'Roles, module permissions and who holds which role. Menus and pages follow these.', ability: 'manage_access' },
]

export default function SettingsPage() {
  const { history } = useShared<{ history: SettingsHistoryEntry[] }>()
  const canPolicy = useCan('manage_policy')
  const canAccess = useCan('manage_access')
  const visible = sections.filter((s) => (s.ability === 'manage_access' ? canAccess : canPolicy))
  return (
    <div className="mx-auto max-w-content">
      <PageHeader title="Settings" description="Company rules for attendance, pay and leave. Policy changes start on a date you choose." />
      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((s) => (
            <Link key={s.title} href={s.href ?? route(s.name!)} className="block">
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
