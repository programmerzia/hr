import { useMemo } from 'react'
import { TaskKey } from '../../components/shared/TaskKey'
import { Badge } from '../../components/ui'
import { cn } from '../../lib/cn'
import { splitTaskRefs } from '../../lib/taskRefs'
import { employees } from '../../mock/db/people'
import { useWork } from '../../mock/stores/work'

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const mentionPattern = new RegExp(
  `(@(?:${[...employees].sort((a, b) => b.name.length - a.name.length).map((e) => escape(e.name)).join('|')}))`,
)

export function MessageText({ body, selfName }: { body: string; selfName: string }) {
  const tasks = useWork((s) => s.tasks)
  const known = useMemo(() => new Set(tasks.map((t) => t.key)), [tasks])
  return (
    <p className="whitespace-pre-wrap break-words text-base">
      {body.split(mentionPattern).map((chunk, i) => {
        if (chunk.startsWith('@') && mentionPattern.test(chunk)) {
          return (
            <span
              key={i}
              className={cn(
                'rounded bg-accent-soft px-1 text-accent',
                chunk === `@${selfName}` && 'font-medium',
              )}
            >
              {chunk}
            </span>
          )
        }
        return splitTaskRefs(chunk).map((part, j) =>
          part.type === 'ref' && known.has(part.value) ? (
            <TaskKey key={`${i}-${j}`} taskKey={part.value} className="text-base" />
          ) : (
            <span key={`${i}-${j}`}>{part.value}</span>
          ),
        )
      })}
    </p>
  )
}

/** Compact card for a task referenced in a message. */
export function TaskCard({ taskKey }: { taskKey: string }) {
  const task = useWork((s) => s.tasks.find((t) => t.key === taskKey))
  const columns = useWork((s) => s.columns)
  const assignee = task?.assignee_id ? employees.find((e) => e.id === task.assignee_id)?.name : null
  if (!task) return null
  const column = columns.find((c) => c.id === task.column_id)
  return (
    <div className="mt-1.5 flex max-w-md items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 shadow-xs">
      <TaskKey taskKey={task.key} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-base">{task.title}</span>
      <Badge variant={column?.is_done ? 'success' : 'neutral'} className="shrink-0 gap-1.5">
        <span className={cn('size-1.5 rounded-full', column?.is_done ? 'bg-success' : 'bg-fg-subtle')} aria-hidden />
        {column?.name ?? 'Task'}
      </Badge>
      <span className="hidden shrink-0 text-sm text-fg-muted sm:inline">{assignee ?? 'Unassigned'}</span>
    </div>
  )
}
