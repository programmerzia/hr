import { CalendarCheck, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { PageHeader } from '../../components/shared/PageHeader'
import { PersonCell } from '../../components/shared/PersonCell'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Button, Dialog, Field, Sheet, Table, Tbody, Td, Textarea, Th, Thead, Tr, toast } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { useAuthed } from '../../mock/session'
import { isUnlimited, useLeaveStore } from '../../mock/stores/leave'
import { usePeopleStore } from '../../mock/stores/people'
import type { LeaveRequest } from '../../types'
import { formatDays, formatRange, halfDayLabels } from './helpers'

export function ApprovalsPage() {
  const { employee, role } = useAuthed()
  const leave = useLeaveStore()
  const people = usePeopleStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | undefined>()

  const queue = leave.pendingFor({ employeeId: employee.id, role })
  const selected = queue.find((r) => r.id === selectedId) ?? null
  const typeOf = (id: string) => leave.leaveTypes.find((t) => t.id === id)
  const nameOf = (id: string) => people.employeeById(id)?.name ?? id
  const stageOf = (r: LeaveRequest) => (r.status === 'pending_lead' ? 'lead' : 'hr')

  const summary = (r: LeaveRequest) => `${typeOf(r.leave_type_id)?.name ?? 'Leave'}, ${formatDays(r.days)}`

  const approve = (r: LeaveRequest) => {
    const res = stageOf(r) === 'lead' ? leave.approveAsLead(r.id, employee.id) : leave.approveAsHr(r.id, employee.id)
    if (res.ok) {
      setSelectedId(null)
      setError(undefined)
      toast.success(`Approved · ${summary(r)}`)
    } else {
      setError(res.error)
      toast.error(res.error)
    }
  }

  const confirmReject = () => {
    if (!rejecting) return
    const res = leave.reject(rejecting.id, stageOf(rejecting), employee.id, note)
    if (!res.ok) {
      setError(res.error)
      toast.error(res.error)
      return
    }
    toast.success(`Rejected · ${summary(rejecting)}`)
    setRejecting(null)
    setSelectedId(null)
    setNote('')
    setError(undefined)
  }

  const scope = role === 'team_lead' ? 'Requests from your team waiting for your decision' : 'Requests that your team leads have passed on to HR'

  return (
    <div className="mx-auto max-w-content">
      <PageHeader title="Leave approvals" description={scope} />
      {queue.length === 0 ? (
        <EmptyTable icon={CalendarCheck} title="Nothing to approve" description="New leave requests will appear here as they come in." />
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Person</Th>
              <Th>Type</Th>
              <Th>Dates</Th>
              <Th numeric>Days</Th>
              <Th>Reason</Th>
              <Th>Stage</Th>
              <Th className="w-44" />
            </tr>
          </Thead>
          <Tbody>
            {queue.map((r) => {
              const e = people.employeeById(r.employee_id)
              const clashes = leave.overlapsFor(r).length
              return (
                <Tr key={r.id} className="cursor-pointer" onClick={() => setSelectedId(r.id)}>
                  <Td><PersonCell name={e?.name ?? r.employee_id} subtitle={e?.designation} /></Td>
                  <Td>{typeOf(r.leave_type_id)?.name}</Td>
                  <Td>
                    {formatRange(r.starts_on, r.ends_on)}
                    {clashes > 0 && <TriangleAlert size={14} className="ml-1.5 inline text-warning" aria-label="Overlaps with teammates" />}
                  </Td>
                  <Td numeric>{r.days}</Td>
                  <Td className="max-w-56 truncate text-fg-muted" title={r.reason}>{r.reason}</Td>
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td className="text-right" onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setError(undefined); setRejecting(r) }}>Reject</Button>
                      <Button size="sm" variant="primary" onClick={() => approve(r)}>Approve</Button>
                    </div>
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      )}
      {error && !rejecting && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}

      <Sheet
        open={!!selected}
        onOpenChange={(o) => !o && setSelectedId(null)}
        title="Leave request"
        description={selected ? nameOf(selected.employee_id) : undefined}
        footer={
          selected && (
            <>
              <Button variant="ghost" onClick={() => { setError(undefined); setRejecting(selected) }}>Reject</Button>
              <Button variant="primary" onClick={() => approve(selected)}>Approve</Button>
            </>
          )
        }
      >
        {selected && <RequestDetail request={selected} />}
      </Sheet>

      <Dialog
        open={!!rejecting}
        onOpenChange={(o) => { if (!o) { setRejecting(null); setNote(''); setError(undefined) } }}
        title="Reject leave request"
        description={rejecting ? `${nameOf(rejecting.employee_id)}, ${formatRange(rejecting.starts_on, rejecting.ends_on)}. They will see your note.` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmReject}>Reject request</Button>
          </>
        }
      >
        <div className="pb-2">
          <Field label="Reason" error={error} required>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </div>
  )
}

function RequestDetail({ request: r }: { request: LeaveRequest }) {
  const leave = useLeaveStore()
  const people = usePeopleStore()
  const type = leave.leaveTypes.find((t) => t.id === r.leave_type_id)
  const e = people.employeeById(r.employee_id)
  const overlaps = leave.overlapsFor(r)
  const after = leave.balanceAfter(r)
  const bal = leave.balancesFor(r.employee_id, Number(r.starts_on.slice(0, 4))).find((b) => b.leave_type_id === r.leave_type_id)
  const history = leave.approvalsFor(r.id)

  const rows: [string, string][] = [
    ['Type', type?.name ?? ''],
    ['Dates', formatRange(r.starts_on, r.ends_on)],
    ['Duration', r.half_day === 'none' ? formatDays(r.days) : `${formatDays(r.days)} (${halfDayLabels[r.half_day].toLowerCase()})`],
    ['Requested', formatDate(r.created_at)],
    ['Reason', r.reason],
    ['Attachment', r.attachment_path ? r.attachment_path.split('/').pop() ?? '' : 'None'],
  ]

  return (
    <div className="flex flex-col gap-5 p-4">
      <PersonCell name={e?.name ?? r.employee_id} subtitle={e?.designation} size="md" />
      <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-fg-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h3 className="mb-1 text-base font-semibold">Balance</h3>
        {type && isUnlimited(type) ? (
          <p className="text-sm text-fg-muted">{type.name} leave has no limit.</p>
        ) : (
          <p className="text-sm text-fg-muted">
            {bal ? `${bal.entitled} entitled, ${bal.used} used, ${bal.pending} pending including this request. ` : ''}
            {after !== null && <span className="font-medium text-fg">{formatDays(after)} left after approval.</span>}
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-base font-semibold">Overlaps with</h3>
        {overlaps.length === 0 ? (
          <p className="text-sm text-fg-muted">No one else in the team is away on these dates.</p>
        ) : (
          <div className="rounded-md border border-warning/40 bg-warning-soft p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-warning">
              <TriangleAlert size={16} /> {overlaps.length} {overlaps.length === 1 ? 'teammate is' : 'teammates are'} also away
            </p>
            <ul className="flex flex-col gap-1.5">
              {overlaps.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                  <PersonCell name={people.employeeById(o.employee_id)?.name ?? o.employee_id} />
                  <span className="shrink-0 text-fg-muted">
                    {formatRange(o.starts_on, o.ends_on)} <StatusBadge status={o.status} className="ml-1" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-base font-semibold">Approval history</h3>
        {history.length === 0 ? (
          <p className="text-sm text-fg-muted">No decisions yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {history.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{people.employeeById(a.decided_by)?.name}</span>{' '}
                <span className="text-fg-muted">
                  {a.decision} as {a.stage === 'lead' ? 'team lead' : 'HR'} on {formatDate(a.decided_at)}
                  {a.note ? `: ${a.note}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
