import { router } from '@inertiajs/react'
import { ClipboardCheck } from 'lucide-react'
import { useState } from 'react'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { PageHeader } from '../../components/shared/PageHeader'
import { PersonCell } from '../../components/shared/PersonCell'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Button, Field, SegmentedControl, Select, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { useShared } from '../../inertia/props'
import { formatDate, formatTime } from '../../lib/format'
import type { AttendanceDay, RegularizationRequest, RegularizationResolution } from '../../types'
import { GradeChip } from './GradeChip'
import { regularizationKindLabels, resolutionLabels } from './lib'
import { ReasonDialog } from './RegularizeDialog'

type Filter = 'pending' | 'all'

interface Row extends RegularizationRequest {
  person: { id: string; name: string; designation: string }
  day: AttendanceDay
  decider_name: string | null
}

export default function RegularizationsPage() {
  const { requests, leave_types: leaveTypes } = useShared<{ requests: Row[]; leave_types: { id: string; name: string }[] }>()
  const [resolution, setResolution] = useState<RegularizationResolution>('excused')
  const [leaveType, setLeaveType] = useState<string>('')
  const decide = (req: Row, decision: 'approved' | 'rejected') => {
    setResolution('excused')
    setLeaveType(leaveTypes[0]?.id ?? '')
    setTarget({ req, decision })
  }
  const [filter, setFilter] = useState<Filter>('pending')
  const [target, setTarget] = useState<{ req: Row; decision: 'approved' | 'rejected' } | null>(null)
  const rows = requests.filter((r) => (filter === 'pending' ? r.status === 'pending' : true))

  const dlgDay = target?.req.day
  const dlgPerson = target?.req.person

  return (
    <>
      <PageHeader
        title="Regularizations"
        description="Late arrivals, early leaves and absences your team asked you to review."
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
          description="Requests appear here when someone asks to regularise a day."
        />
      ) : (
        <Table>
          <Thead>
            <Tr className="hover:bg-transparent">
              <Th>Person</Th>
              <Th>Date</Th>
              <Th numeric>In</Th>
              <Th>Kind</Th>
              <Th numeric>Late (min)</Th>
              <Th>Grade</Th>
              <Th>Reason</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((r) => {
              const e = r.person
              const d = r.day
              return (
                <Tr key={r.id}>
                  <Td>{e && <PersonCell name={e.name} subtitle={e.designation} />}</Td>
                  <Td>{d ? formatDate(d.date) : '-'}</Td>
                  <Td numeric>{d?.first_in_at ? formatTime(d.first_in_at) : '-'}</Td>
                  <Td>{regularizationKindLabels[r.kind] ?? r.kind}</Td>
                  <Td numeric>{d ? d.late_minutes : '-'}</Td>
                  <Td>
                    <GradeChip day={d} />
                  </Td>
                  <Td className="min-w-48 max-w-72 whitespace-normal">
                    <p className="truncate" title={r.reason}>
                      {r.reason}
                    </p>
                    {r.note && (
                      <p className="truncate text-xs text-fg-muted" title={r.note}>
                        {r.decider_name}: {r.note}
                      </p>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge status={r.status} />
                    {r.resolution && <p className="text-xs text-fg-muted">{resolutionLabels[r.resolution]}</p>}
                  </Td>
                  <Td className="text-right">
                    {r.status === 'pending' && (
                      <span className="inline-flex gap-2">
                        <Button size="sm" onClick={() => decide(r, 'rejected')}>
                          Reject
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => decide(r, 'approved')}>
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
            ? `${dlgPerson.name}, ${formatDate(dlgDay.date)}: ${(regularizationKindLabels[target.req.kind] ?? '').toLowerCase()}.`
            : undefined
        }
        label={target?.decision === 'approved' ? 'Note' : 'Reason for rejecting'}
        required={target?.decision === 'rejected'}
        confirmLabel={target?.decision === 'approved' ? 'Approve' : 'Reject'}
        destructive={target?.decision === 'rejected'}
        disabled={target?.decision === 'approved' && resolution === 'paid_leave' && !leaveType}
        onConfirm={(note) => {
          if (!target) return
          const extra =
            target.decision === 'approved'
              ? { resolution, leave_type_id: resolution === 'paid_leave' ? leaveType : null }
              : {}
          router.post(
            route('attendance.regularizations.decide'),
            { id: target.req.id, decision: target.decision, note, ...extra },
            { preserveScroll: true },
          )
        }}
      >
        {target?.decision === 'approved' && (
          <>
            <Field label="Resolution">
              <Select
                value={resolution}
                onValueChange={(v) => setResolution(v as RegularizationResolution)}
                options={(['excused', 'paid_leave', 'unpaid_leave', 'keep'] as const).map((k) => ({ value: k, label: resolutionLabels[k] ?? k }))}
              />
            </Field>
            {resolution === 'paid_leave' && (
              <Field label="Leave type" required>
                <Select
                  value={leaveType || undefined}
                  onValueChange={setLeaveType}
                  placeholder="Pick a paid leave type"
                  options={leaveTypes.map((t) => ({ value: t.id, label: t.name }))}
                />
              </Field>
            )}
          </>
        )}
      </ReasonDialog>
    </>
  )
}
