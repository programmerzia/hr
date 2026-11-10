import { PageHeader } from '../../components/shared/PageHeader'
import { useAuthed } from '../../mock/session'

const lines = {
  employee: 'Your clock, tasks and leave balance will show here.',
  team_lead: 'Your team status and pending approvals will show here.',
  hr: 'Hiring, leave and payroll items waiting on HR will show here.',
  management: 'Company stats and invoices due will show here.',
} as const

export function HomePage() {
  const { role } = useAuthed()
  return (
    <div className="mx-auto max-w-content">
      <PageHeader title="Home" description={lines[role]} />
    </div>
  )
}
