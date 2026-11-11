import { Link, router } from '@inertiajs/react'
import { CalendarDays, Plane, Plus } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Button, buttonVariants, Stat, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { useAuth, useShared } from '../../inertia/props'
import { formatDate } from '../../lib/format'
import type { AttendancePolicy, Holiday, LeaveRequest, LeaveType } from '../../types'
import { formatDays, formatRange, halfDayLabels, shortTypeName, todayIso, type BalanceRow } from './helpers'
import { RequestLeaveDialog } from './RequestLeaveDialog'

interface MyLeaveProps {
  year: number
  balances: BalanceRow[]
  requests: LeaveRequest[]
  leave_types: LeaveType[]
  holidays: Holiday[]
  policy: AttendancePolicy
}

export default function MyLeavePage() {
  const { role } = useAuth()
  const { year, balances: allBalances, requests, leave_types, holidays, policy } = useShared<MyLeaveProps>()
  const [open, setOpen] = useState(false)
  const [toCancel, setToCancel] = useState<LeaveRequest | null>(null)
  const typeById = (id: string) => leave_types.find((t) => t.id === id)
  const balances = allBalances.filter((b) => b.year === year && (b.unlimited || b.entitled > 0 || b.used > 0 || b.pending > 0))
  const typeName = (id: string) => typeById(id)?.name ?? id
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
              <Link href="/leave/policy" className={buttonVariants({ variant: 'secondary' })}>
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
            icon={Plane}
            label={`${typeName(b.leave_type_id)}${typeById(b.leave_type_id)?.is_paid ? '' : ' (unpaid)'}`}
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

      <RequestLeaveDialog
        open={open}
        onOpenChange={setOpen}
        leaveTypes={leave_types}
        balances={allBalances}
        holidays={holidays.map((h) => h.date)}
        weekend={policy.weekend_days}
      />
      <ConfirmDialog
        open={!!toCancel}
        onOpenChange={(o) => !o && setToCancel(null)}
        title="Cancel leave request"
        description={
          toCancel
            ? `Cancel your ${shortTypeName(typeName(toCancel.leave_type_id)).toLowerCase()} leave for ${formatRange(toCancel.starts_on, toCancel.ends_on)} (${formatDays(toCancel.days)})? The days go back to your balance.`
            : ''
        }
        confirmLabel="Cancel request"
        destructive
        onConfirm={() => {
          if (toCancel) router.post(route('leave.cancel', toCancel.id), {}, { preserveScroll: true })
          setToCancel(null)
        }}
      />
    </div>
  )
}
