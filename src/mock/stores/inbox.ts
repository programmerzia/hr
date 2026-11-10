import { useMemo, useState } from 'react'
import { navBadges } from '../../app/nav'
import { toast } from '../../components/ui'
import { listOf, useOptionalState } from '../optional'
import { employeeById } from '../db/people'
import { useSession } from '../session'
import type { ContractorClaim, PayrollRun } from '../../types'
import { scopeEmployees, useAttendance } from './attendance'
import { conversationTitle, useChat } from './chat'
import { useLeaveStore } from './leave'
import { usePeopleStore } from './people'

export type InboxKind = 'leave' | 'regularization' | 'claim' | 'payroll' | 'mention'

export interface InboxAction {
  label: string
  tone: 'approve' | 'reject'
  /** Reject actions receive the note the person typed. */
  run: (note?: string) => void
}

export interface InboxItem {
  id: string
  kind: InboxKind
  title: string
  subtitle: string
  /** Person the row is about. */
  person: string | null
  at: string
  href: string
  actions?: InboxAction[]
}

const WEEK_MS = 7 * 24 * 3600 * 1000
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function report(result: { ok: boolean; error?: string } | boolean, done: string) {
  if (typeof result === 'boolean' ? result : result.ok) toast.success(done)
  else toast.error(typeof result === 'boolean' ? 'Could not save the decision' : (result.error ?? 'Could not save the decision'))
}

/** Everything waiting on the signed-in person, newest first. */
export function useInboxItems(): InboxItem[] {
  const employee = useSession((s) => s.employee)
  const role = useSession((s) => s.role)
  const requests = useLeaveStore((s) => s.requests)
  const leaveTypes = useLeaveStore((s) => s.leaveTypes)
  const regs = useAttendance((s) => s.regularizations)
  const days = useAttendance((s) => s.days)
  const people = usePeopleStore((s) => s.employees)
  const messages = useChat((s) => s.messages)
  const conversations = useChat((s) => s.conversations)
  const members = useChat((s) => s.members)
  const [openedAt] = useState(() => Date.now())
  const payroll = useOptionalState('payroll')
  const billing = useOptionalState('billing')

  // requests feeds pendingFor(), which reads the store directly
  /* eslint-disable react-hooks/exhaustive-deps */
  return useMemo(() => {
    if (!employee || !role) return []
    const me = employee.id
    const items: InboxItem[] = []
    const nameOf = (id: string) => employeeById(id)?.name ?? id

    // Leave approvals
    const leave = useLeaveStore.getState()
    for (const r of leave.pendingFor({ employeeId: me, role })) {
      const type = leaveTypes.find((t) => t.id === r.leave_type_id)?.name ?? 'leave'
      const stage = r.status === 'pending_lead' ? 'lead' : 'hr'
      const decide = (note: string | undefined, approve: boolean) => {
        const st = useLeaveStore.getState()
        const res = approve
          ? stage === 'lead'
            ? st.approveAsLead(r.id, me, note)
            : st.approveAsHr(r.id, me, note)
          : st.reject(r.id, stage, me, note || 'Rejected')
        report(res, approve ? 'Leave approved' : 'Leave rejected')
      }
      items.push({
        id: `leave-${r.id}`,
        kind: 'leave',
        title: `${nameOf(r.employee_id)} requests ${r.days} ${r.days === 1 ? 'day' : 'days'} of ${type.toLowerCase()}`,
        subtitle: `${r.starts_on}${r.ends_on !== r.starts_on ? ` to ${r.ends_on}` : ''}. ${r.reason}`,
        person: nameOf(r.employee_id),
        at: r.created_at,
        href: '/leave/approvals',
        actions: [
          { label: 'Approve', tone: 'approve', run: () => decide(undefined, true) },
          { label: 'Reject', tone: 'reject', run: (note) => decide(note, false) },
        ],
      })
    }

    // Regularizations
    if (role !== 'employee') {
      const scope = new Set(scopeEmployees(me, role).map((e) => e.id))
      for (const r of regs) {
        if (r.status !== 'pending' || r.employee_id === me || !scope.has(r.employee_id)) continue
        const day = days.find((d) => d.id === r.attendance_day_id)
        const decide = (approve: boolean, note?: string) =>
          report(
            useAttendance
              .getState()
              .decideRegularization(r.id, approve ? 'approved' : 'rejected', note || (approve ? 'Approved' : 'Rejected'), me),
            approve ? 'Regularization approved' : 'Regularization rejected',
          )
        items.push({
          id: `reg-${r.id}`,
          kind: 'regularization',
          title: `${nameOf(r.employee_id)} asks to regularize ${day?.date ?? 'a day'}`,
          subtitle: r.reason,
          person: nameOf(r.employee_id),
          at: r.created_at,
          href: '/team/regularizations',
          actions: [
            { label: 'Approve', tone: 'approve', run: () => decide(true) },
            { label: 'Reject', tone: 'reject', run: (note) => decide(false, note) },
          ],
        })
      }
    }

    // Contractor claims (optional Billing module). Leads verify, management approves.
    const claims = listOf<ContractorClaim>(billing, 'claims')
    if (claims && (role === 'team_lead' || role === 'management')) {
      const mates = new Set(people.filter((e) => role === 'management' || scopeEmployees(me, role).some((s) => s.id === e.id)).map((e) => e.id))
      for (const c of claims) {
        const waiting = role === 'management' ? c.status === 'submitted' || c.status === 'verified' : c.status === 'submitted'
        if (!waiting || c.employee_id === me || !mates.has(c.employee_id)) continue
        items.push({
          id: `claim-${c.id}`,
          kind: 'claim',
          title: `${nameOf(c.employee_id)} claim for ${monthNames[c.month - 1]} ${c.year} needs ${c.status === 'submitted' ? 'verification' : 'approval'}`,
          subtitle: `${Math.round(c.claimed_minutes / 60)}h claimed, ${Math.round(c.tracked_minutes / 60)}h tracked`,
          person: nameOf(c.employee_id),
          at: `${c.year}-${String(c.month).padStart(2, '0')}-28T10:00:00+06:00`,
          href: `/claims/${c.id}`,
        })
      }
    }

    // Payroll runs awaiting approval (optional Payroll module)
    const runs = listOf<PayrollRun>(payroll, 'runs')
    if (runs && role === 'management') {
      for (const run of runs) {
        if (run.status !== 'review') continue
        items.push({
          id: `payroll-${run.id}`,
          kind: 'payroll',
          title: `${monthNames[run.month - 1]} ${run.year} payroll is waiting for approval`,
          subtitle: 'Review the run and approve it to unlock payment.',
          person: null,
          at: `${run.year}-${String(run.month).padStart(2, '0')}-25T10:00:00+06:00`,
          href: `/payroll/${run.id}`,
        })
      }
    }

    // Mentions in the last 7 days
    const mention = `@${employee.name}`
    const cutoff = openedAt - WEEK_MS
    const mine = new Set(members.filter((m) => m.employee_id === me).map((m) => m.conversation_id))
    for (const m of messages) {
      if (m.author_id === me || !mine.has(m.conversation_id) || !m.body.includes(mention)) continue
      if (new Date(m.created_at).getTime() < cutoff) continue
      const conv = conversations.find((c) => c.id === m.conversation_id)
      const title = conv
        ? conversationTitle(conv, me, members.filter((x) => x.conversation_id === conv.id).map((x) => x.employee_id))
        : 'a conversation'
      items.push({
        id: `mention-${m.id}`,
        kind: 'mention',
        title: `${nameOf(m.author_id)} mentioned you in ${title}`,
        subtitle: m.body,
        person: nameOf(m.author_id),
        at: m.created_at,
        href: `/chat/${m.conversation_id}`,
      })
    }

    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [employee, role, requests, leaveTypes, regs, days, people, messages, conversations, members, payroll, billing, openedAt])
  /* eslint-enable react-hooks/exhaustive-deps */
}

export function isApprovalKind(kind: InboxKind): boolean {
  return kind !== 'mention'
}

/** Count of actionable (non-mention) items. */
export function useInboxCount(): number {
  return useInboxItems().filter((i) => isApprovalKind(i.kind)).length
}

navBadges.set('inbox', useInboxCount)
