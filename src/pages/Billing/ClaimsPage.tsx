import { Receipt } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { MoneyCell } from '../../components/shared/MoneyCell'
import { PageHeader } from '../../components/shared/PageHeader'
import { PersonCell } from '../../components/shared/PersonCell'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Button, SegmentedControl, Table, Tbody, Td, Th, Thead, Tr, toast } from '../../components/ui'
import { useAuthed } from '../../mock/session'
import { useBilling } from '../../mock/stores/billing'
import { usePeopleStore } from '../../mock/stores/people'
import { ClaimActions, claimMode } from './ClaimActions'
import { hoursText, monthLabel } from './helpers'

type Scope = 'action' | 'all'

export function ClaimsPage() {
  const { employee, role } = useAuthed()
  const mode = claimMode(role)
  const b = useBilling()
  const employees = usePeopleStore((s) => s.employees)
  const navigate = useNavigate()
  const [scope, setScope] = useState<Scope>('action')

  const viewer = { employeeId: employee.id, role }
  const all = b.claimsVisibleTo(viewer)
  const awaiting = new Set(b.claimsAwaiting(viewer).map((c) => c.id))
  const showScope = mode !== 'contractor'
  const claims = showScope && scope === 'action' ? all.filter((c) => awaiting.has(c.id) || (mode === 'management' && c.status === 'approved')) : all

  const nameOf = (id: string) => employees.find((e) => e.id === id)?.name ?? id
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const hasThisMonth = all.some((c) => c.employee_id === employee.id && c.year === year && c.month === month)

  const generate = () => {
    const res = b.generateClaim(employee.id, year, month)
    if (!res.ok) toast.error(res.error)
    else navigate(`/claims/${res.value.id}`)
  }

  const description =
    mode === 'contractor'
      ? 'Monthly claims from your tracked hours.'
      : mode === 'lead'
        ? 'Check each contractor’s claimed hours against tracked time.'
        : 'Verified claims wait for your approval, then payment.'

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="Claims"
        description={description}
        actions={
          mode === 'contractor' && !hasThisMonth ? (
            <Button variant="primary" onClick={generate}>
              Generate claim for {monthLabel(year, month)}
            </Button>
          ) : undefined
        }
        tabs={
          showScope ? (
            <SegmentedControl<Scope>
              aria-label="Claims shown"
              value={scope}
              onValueChange={setScope}
              options={[
                { value: 'action', label: `Needs action (${awaiting.size})` },
                { value: 'all', label: 'All claims' },
              ]}
            />
          ) : undefined
        }
      />

      {claims.length === 0 ? (
        <EmptyTable
          icon={Receipt}
          title={showScope && scope === 'action' ? 'Nothing to review' : 'No claims yet'}
          description={
            mode === 'contractor'
              ? 'Generate this month’s claim when you are ready to bill your hours.'
              : showScope && scope === 'action'
                ? 'Claims that need your action will show up here.'
                : 'Claims appear here once contractors generate them.'
          }
        />
      ) : (
        <Table>
          <Thead>
            <tr>
              {mode !== 'contractor' && <Th>Contractor</Th>}
              <Th>Period</Th>
              <Th numeric>Tracked</Th>
              <Th numeric>Claimed</Th>
              {mode !== 'contractor' && <Th numeric>Difference</Th>}
              <Th numeric>Total</Th>
              <Th>Status</Th>
              <Th className="w-32" />
            </tr>
          </Thead>
          <Tbody>
            {claims.map((c) => {
              const diff = c.claimed_minutes - c.tracked_minutes
              return (
                <Tr key={c.id} className="cursor-pointer" onClick={() => navigate(`/claims/${c.id}`)}>
                  {mode !== 'contractor' && (
                    <Td>
                      <PersonCell name={nameOf(c.employee_id)} />
                    </Td>
                  )}
                  <Td>{monthLabel(c.year, c.month)}</Td>
                  <Td numeric>{hoursText(c.tracked_minutes)}</Td>
                  <Td numeric>{hoursText(c.claimed_minutes)}</Td>
                  {mode !== 'contractor' && (
                    <Td numeric className={diff > 0 ? 'text-warning' : 'text-fg-muted'}>
                      {diff === 0 ? 'Matches' : `${diff > 0 ? '+' : '-'}${hoursText(Math.abs(diff))}`}
                    </Td>
                  )}
                  <Td>
                    <MoneyCell amount={c.total} currency="BDT" />
                  </Td>
                  <Td>
                    <StatusBadge status={c.status} />
                  </Td>
                  <Td className="text-right">
                    <ClaimActions claim={c} />
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
