import { CheckCircle2, ChevronRight, MessageSquare } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { TaskKey } from '../../components/shared/TaskKey'
import { Badge, Card, CardBody, CardHeader, EmptyState, Progress } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { todayKey } from '../../mock/stores/attendance'
import { useChat } from '../../mock/stores/chat'
import { useLeaveStore } from '../../mock/stores/leave'
import { useMyTasks } from '../../mock/stores/work'
import { PriorityIcon } from '../Work/shared'

export function MyTasksCard() {
  const tasks = useMyTasks()
  const top = useMemo(
    () =>
      [...tasks]
        .sort((a, b) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999') || a.number - b.number)
        .slice(0, 6),
    [tasks],
  )
  const today = todayKey()
  return (
    <Card>
      <CardHeader
        title="My tasks"
        actions={
          <Link to="/tasks" className="text-sm text-accent hover:underline">
            View all{tasks.length > top.length ? ` ${tasks.length}` : ''}
          </Link>
        }
      />
      {top.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nothing assigned" description="Tasks assigned to you will appear here." className="py-8" />
      ) : (
        <ul>
          {top.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 border-b border-border px-4 py-2.5 transition-colors duration-150 last:border-b-0 hover:bg-surface-2"
            >
              <PriorityIcon priority={t.priority} />
              <TaskKey taskKey={t.key} className="w-20 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              {t.due_on && (
                <Badge variant={t.due_on < today ? 'danger' : 'neutral'} className="shrink-0">
                  {t.due_on < today ? 'Overdue ' : 'Due '}
                  {formatDate(t.due_on)}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function LeaveBalancesCard({ employeeId }: { employeeId: string }) {
  useLeaveStore((s) => s.balances)
  const balances = useLeaveStore.getState().balancesFor(employeeId, new Date().getFullYear())
  const shown = balances.filter((b) => !b.unlimited && b.entitled > 0)
  return (
    <Card>
      <CardHeader
        title="Leave balance"
        actions={
          <Link to="/leave" className="text-sm text-accent hover:underline">
            Request leave
          </Link>
        }
      />
      {shown.length === 0 ? (
        <EmptyState title="No leave balances" description="Your balances will show once leave types are set up." className="py-8" />
      ) : (
        <ul className="space-y-3 p-4">
          {shown.map((b) => (
            <li key={b.id}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span>{b.type.name}</span>
                <span className="font-mono text-sm tabular-nums">
                  {b.available}
                  <span className="text-fg-muted"> of {b.entitled} days</span>
                </span>
              </div>
              <Progress
                value={b.available}
                max={b.entitled}
                tone={b.available / b.entitled < 0.2 ? 'warning' : 'accent'}
                aria-label={`${b.type.name}: ${b.available} of ${b.entitled} days left`}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Shown only when there is something unread. */
export function ChatCard({ employeeId }: { employeeId: string }) {
  const unread = useChat((s) => s.totalUnread(employeeId))
  if (unread === 0) return null
  return (
    <Link to="/chat" className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
      <Card interactive>
        <CardBody className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden>
            <MessageSquare size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Chat</p>
            <p className="text-sm text-fg-muted">
              {unread} unread {unread === 1 ? 'message' : 'messages'}
            </p>
          </div>
          <ChevronRight size={16} className="text-fg-subtle" aria-hidden />
        </CardBody>
      </Card>
    </Link>
  )
}
