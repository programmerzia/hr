import { CalendarDays, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Button, buttonVariants, Stat, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { useAuthed } from '../../mock/session'
import { useLeaveStore } from '../../mock/stores/leave'
import { todayIso } from '../../mock/stores/people'
import type { LeaveRequest } from '../../types'
import { formatDays, formatRange, halfDayLabels } from './helpers'
import { RequestLeaveDialog } from './RequestLeaveDialog'

export function MyLeavePage() {
  const { employee, role } = useAuthed()
  const leave = useLeaveStore()
  const [open, setOpen] = useState(false)
  const [toCancel, setToCancel] = useState<LeaveRequest | null>(null)
  const year = new Date().getFullYear()
  const balances = leave.balancesFor(employee.id, year).filter((b) => b.unlimited || b.entitled > 0 || b.used > 0 || b.pending > 0)
  const requests = leave.requestsFor(employee.id)
  const typeName = (id: string) => leave.leaveTypes.find((t) => t.id === id)?.name ?? id
  const canCancel = (r: LeaveRequest) =>
    r.status === 'pending_lead' || r.status === 'pending_hr' || (r.status === 'approved' && r.starts_on > todayIso())

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="Leave"
        description={`Balances for ${year}`}
        actions={
          <>
            {(role === 'hr' || role === 'management') && (
              <Link to="/leave/policy" className={buttonVariants({ variant: 'secondary' })}>
                Leave policy
              </Link>
            )}
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setOpen(true)}>
            Request leave
          </Button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {balances.map((b) => (
          <Stat
            key={b.id}
            label={`${b.type.name}${b.type.is_paid ? '' : ' (unpaid)'}`}
            value={b.unlimited ? 'Unlimited' : `${b.available} of ${b.entitled}`}
            delta={{ value: `${b.used} used, ${b.pending} pending`, tone: 'neutral' }}
          />
        ))}
      </div>

      <h2 className="mb-2 text-lg font-semibold">My requests</h2>
      {requests.length === 0 ? (
        <EmptyTable
          icon={CalendarDays}
          title="No leave requests"
          description="Requests you submit will show up here with their approval status."
          action={<Button variant="primary" onClick={() => setOpen(true)}>Request leave</Button>}
        />
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Type</Th>
              <Th>Dates</Th>
              <Th numeric>Days</Th>
              <Th>Reason</Th>
              <Th>Status</Th>
              <Th>Requested</Th>
              <Th className="w-24" />
            </tr>
          </Thead>
          <Tbody>
            {requests.map((r) => (
              <Tr key={r.id}>
                <Td>{typeName(r.leave_type_id)}</Td>
                <Td>
                  {formatRange(r.starts_on, r.ends_on)}
                  {r.half_day !== 'none' && <span className="text-fg-muted"> ({halfDayLabels[r.half_day].toLowerCase()})</span>}
                </Td>
                <Td numeric>{r.days}</Td>
                <Td className="max-w-64 truncate text-fg-muted" title={r.reason}>{r.reason}</Td>
                <Td><StatusBadge status={r.status} /></Td>
                <Td className="text-fg-muted">{formatDate(r.created_at)}</Td>
                <Td className="text-right">
                  {canCancel(r) && (
                    <Button size="sm" variant="ghost" onClick={() => setToCancel(r)}>
                      Cancel
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <RequestLeaveDialog open={open} onOpenChange={setOpen} employeeId={employee.id} />
      <ConfirmDialog
        open={!!toCancel}
        onOpenChange={(o) => !o && setToCancel(null)}
        title="Cancel leave request"
        description={
          toCancel
            ? `Cancel your ${typeName(toCancel.leave_type_id).toLowerCase()} leave for ${formatRange(toCancel.starts_on, toCancel.ends_on)} (${formatDays(toCancel.days)})? The days go back to your balance.`
            : ''
        }
        confirmLabel="Cancel request"
        destructive
        onConfirm={() => {
          if (toCancel) leave.cancel(toCancel.id)
          setToCancel(null)
        }}
      />
    </div>
  )
}
