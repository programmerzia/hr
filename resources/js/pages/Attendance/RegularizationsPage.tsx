import { ClipboardCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { PageHeader } from '../../components/shared/PageHeader'
import { PersonCell } from '../../components/shared/PersonCell'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Button, SegmentedControl, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { formatDate, formatTime } from '../../lib/format'
import { employeeById } from '../../mock/db/people'
import { useSession } from '../../mock/session'
import { scopeEmployees, useAttendance } from '../../mock/stores/attendance'
import type { RegularizationRequest } from '../../types'
import { ReasonDialog } from './RegularizeDialog'

type Filter = 'pending' | 'all'

export function RegularizationsPage() {
  const employee = useSession((s) => s.employee)
  const role = useSession((s) => s.role)
  const regs = useAttendance((s) => s.regularizations)
  const days = useAttendance((s) => s.days)
  const decide = useAttendance((s) => s.decideRegularization)
  const [filter, setFilter] = useState<Filter>('pending')
  const [target, setTarget] = useState<{ req: RegularizationRequest; decision: 'approved' | 'rejected' } | null>(null)

  const rows = useMemo(() => {
    if (!employee || !role) return []
    const ids = new Set(scopeEmployees(employee.id, role).map((e) => e.id))
    return regs
      .filter((r) => ids.has(r.employee_id) && r.employee_id !== employee.id)
      .filter((r) => (filter === 'pending' ? r.status === 'pending' : true))
      .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || (a.created_at < b.created_at ? 1 : -1))
  }, [regs, employee, role, filter])

  if (!employee) return null
  const dlgDay = target ? days.find((d) => d.id === target.req.attendance_day_id) : undefined
  const dlgPerson = target ? employeeById(target.req.employee_id) : undefined

  return (
    <>
      <PageHeader
        title="Regularizations"
        description="Late arrivals your team asked you to excuse."
        actions={
          <SegmentedControl
            aria-label="Filter"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'all', label: 'All' },
            ]}
          />
        }
      />
      {rows.length === 0 ? (
        <EmptyTable
          icon={ClipboardCheck}
          title={filter === 'pending' ? 'Nothing to review' : 'No requests yet'}
          description="Requests appear here when someone asks to excuse a late arrival."
        />
      ) : (
        <Table>
          <Thead>
            <Tr className="hover:bg-transparent">
              <Th>Person</Th>
              <Th>Date</Th>
              <Th numeric>In</Th>
              <Th numeric>Late (min)</Th>
              <Th>Reason</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((r) => {
              const e = employeeById(r.employee_id)
              const d = days.find((x) => x.id === r.attendance_day_id)
              const decider = r.decided_by ? employeeById(r.decided_by) : undefined
              return (
                <Tr key={r.id}>
                  <Td>{e && <PersonCell name={e.name} subtitle={e.designation} />}</Td>
                  <Td>{d ? formatDate(d.date) : '-'}</Td>
                  <Td numeric>{d?.first_in_at ? formatTime(d.first_in_at) : '-'}</Td>
                  <Td numeric>{d ? d.late_minutes : '-'}</Td>
                  <Td className="max-w-80">
                    <p className="truncate" title={r.reason}>
                      {r.reason}
                    </p>
                    {r.note && (
                      <p className="truncate text-xs text-fg-muted" title={r.note}>
                        {decider?.name}: {r.note}
                      </p>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge status={r.status} />
                  </Td>
                  <Td className="text-right">
                    {r.status === 'pending' && (
                      <span className="inline-flex gap-2">
                        <Button size="sm" onClick={() => setTarget({ req: r, decision: 'rejected' })}>
                          Reject
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => setTarget({ req: r, decision: 'approved' })}>
                          Approve
                        </Button>
                      </span>
                    )}
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      )}
      <ReasonDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target?.decision === 'approved' ? 'Approve regularization' : 'Reject regularization'}
        description={
          dlgPerson && dlgDay
            ? `${dlgPerson.name}, ${formatDate(dlgDay.date)}, late by ${dlgDay.late_minutes} minutes.`
            : undefined
        }
        label={target?.decision === 'approved' ? 'Note' : 'Reason for rejecting'}
        required={target?.decision === 'rejected'}
        confirmLabel={target?.decision === 'approved' ? 'Approve' : 'Reject'}
        destructive={target?.decision === 'rejected'}
        onConfirm={(note) => {
          if (target) decide(target.req.id, target.decision, note, employee.id)
        }}
      />
    </>
  )
}
