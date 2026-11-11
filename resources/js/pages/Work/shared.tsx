import { ChevronDown, ChevronsUp, ChevronUp, Equal } from 'lucide-react'
import { router } from '@inertiajs/react'
import { Fragment, useMemo, type ReactNode } from 'react'
import { format } from 'date-fns'
import { TaskKey } from '../../components/shared/TaskKey'
import { Avatar, Badge } from '../../components/ui'
import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/format'
import { splitTaskRefs } from '../../lib/taskRefs'
import { useShared, usePathname } from '../../inertia/props'
import type {
  Attachment,
  BoardColumn,
  Label,
  Project,
  ProjectMember,
  Subtask,
  Task,
  TaskActivity,
  TaskComment,
  TaskPriority,
} from '../../types'

export interface Person {
  id: string
  name: string
}

/** Task as boards and lists receive it: the TS Task plus label ids and subtask counts. */
export interface TaskRow extends Task {
  label_ids: string[]
  subtask_total: number
  subtask_done: number
}

/** Task for the drawer, with everything it renders. */
export interface DrawerTask extends TaskRow {
  project: Pick<Project, 'id' | 'key' | 'name'>
  columns: BoardColumn[]
  labels: Label[]
  member_ids: string[]
  people: Person[]
  can_edit: boolean
  subtasks: Subtask[]
  comments: TaskComment[]
  attachments: Attachment[]
  activity: TaskActivity[]
  tracked_seconds: number
}

export type ProjectRow = Project & { client_name: string | null }

/** Props of the board and list pages (WorkData::projectScreen). */
export interface ProjectScreenProps {
  project: ProjectRow
  columns: BoardColumn[]
  tasks: TaskRow[]
  members: ProjectMember[]
  labels: Label[]
  people: Person[]
  candidates: Person[]
  can_write: boolean
  can_manage: boolean
  task: DrawerTask | null
  task_key: string | null
}

export const priorityLabels: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}
export const priorityOrder: TaskPriority[] = ['urgent', 'high', 'medium', 'low']

export function isDoneTask(task: Pick<Task, 'column_id'>, columns: BoardColumn[]): boolean {
  return columns.find((c) => c.id === task.column_id)?.is_done ?? false
}

/** Name lookup over the page's `people` prop and the open drawer task's people. */
export function usePersonName(): (id: string | null | undefined) => string {
  const { people = [], task } = useShared<{ people?: Person[]; task?: { people: Person[] } | null }>()
  return useMemo(() => {
    const map = new Map<string, string>()
    for (const p of [...people, ...(task?.people ?? [])]) map.set(p.id, p.name)
    return (id) => (id ? (map.get(id) ?? id) : 'Unassigned')
  }, [people, task])
}

/** Opens (key) or closes (null) the task drawer by setting `?task=KEY` without a full reload. */
export function useTaskParam() {
  const path = usePathname()
  return (key: string | null) => {
    const params = new URLSearchParams(window.location.search)
    if (key) params.set('task', key)
    else params.delete('task')
    router.get(path, Object.fromEntries(params), {
      preserveState: true,
      preserveScroll: true,
      replace: true,
      only: ['task', 'task_key'],
    })
  }
}

export const todayIso = () => format(new Date(), 'yyyy-MM-dd')

export function isOverdue(task: Task, columns: BoardColumn[]): boolean {
  return !!task.due_on && task.due_on < todayIso() && !isDoneTask(task, columns)
}

export function isDueSoon(task: Task, columns: BoardColumn[], days = 3): boolean {
  if (!task.due_on || isDoneTask(task, columns)) return false
  const limit = format(new Date(Date.now() + days * 86_400_000), 'yyyy-MM-dd')
  return task.due_on >= todayIso() && task.due_on <= limit
}

const priorityIcons: Record<TaskPriority, { icon: typeof Equal; tone: string }> = {
  urgent: { icon: ChevronsUp, tone: 'text-danger' },
  high: { icon: ChevronUp, tone: 'text-warning' },
  medium: { icon: Equal, tone: 'text-fg-muted' },
  low: { icon: ChevronDown, tone: 'text-fg-subtle' },
}

export function PriorityIcon({ priority, withLabel }: { priority: TaskPriority; withLabel?: boolean }) {
  const { icon: Icon, tone } = priorityIcons[priority]
  const label = priority[0].toUpperCase() + priority.slice(1)
  return (
    <span className={cn('inline-flex items-center gap-1', tone)} title={`Priority: ${label}`}>
      <Icon size={16} aria-label={`Priority ${label}`} />
      {withLabel && <span className="text-sm text-fg">{label}</span>}
    </span>
  )
}

export function DueDate({ task, columns, className }: { task: Task; columns: BoardColumn[]; className?: string }) {
  if (!task.due_on) return <span className={cn('text-fg-subtle', className)}>No date</span>
  const overdue = isOverdue(task, columns)
  const soon = isDueSoon(task, columns)
  return (
    <span className={cn(overdue ? 'font-medium text-danger' : soon ? 'text-warning' : 'text-fg-muted', className)}>
      {formatDate(task.due_on)}
    </span>
  )
}

const labelDot: Record<Label['color'], string> = {
  neutral: 'bg-fg-subtle',
  success: 'bg-chart-6',
  warning: 'bg-chart-4',
  danger: 'bg-chart-5',
  info: 'bg-chart-2',
  accent: 'bg-chart-1',
}

export function LabelChips({ labels }: { labels: Label[] }) {
  if (labels.length === 0) return null
  return (
    <>
      {labels.map((l) => (
        <Badge key={l.id} className="gap-1.5 bg-surface-2 text-fg-muted">
          <span className={cn('size-1.5 rounded-full', labelDot[l.color])} aria-hidden />
          {l.name}
        </Badge>
      ))}
    </>
  )
}

export function AvatarStack({ ids, max = 4 }: { ids: string[]; max?: number }) {
  const personName = usePersonName()
  const shown = ids.slice(0, max)
  return (
    <div className="flex items-center">
      {shown.map((id) => (
        <span key={id} title={personName(id)} className="-ml-1 first:ml-0 rounded-full ring-2 ring-surface">
          <Avatar name={personName(id)} size="sm" />
        </span>
      ))}
      {ids.length > max && <span className="ml-1.5 text-xs text-fg-muted">+{ids.length - max}</span>}
    </div>
  )
}

export function useLabelsFor(task: { label_ids: string[] }): Label[] {
  const { labels = [] } = useShared<{ labels?: Label[] }>()
  return useMemo(() => labels.filter((l) => task.label_ids.includes(l.id)), [labels, task.label_ids])
}

// ---------- Light markdown ----------

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).flatMap((chunk, i) => {
    if (!chunk) return []
    const k = `${keyPrefix}-${i}`
    if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length > 2)
      return [
        <code key={k} className="rounded bg-surface-2 px-1 font-mono text-sm">
          {chunk.slice(1, -1)}
        </code>,
      ]
    if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length > 4)
      return [<strong key={k}>{chunk.slice(2, -2)}</strong>]
    return splitTaskRefs(chunk).map((part, j) =>
      part.type === 'ref' ? <TaskKey key={`${k}-${j}`} taskKey={part.value} /> : <Fragment key={`${k}-${j}`}>{part.value}</Fragment>,
    )
  })
}

/** Paragraphs, bullet lists, `code`, **bold** and task references. */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = source.split(/\n{2,}/).filter((b) => b.trim())
  return (
    <div className={cn('flex flex-col gap-2 text-base', className)}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n')
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={bi} className="list-disc pl-5">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ''), `${bi}-${li}`)}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={bi} className="whitespace-pre-wrap">
            {inline(block, String(bi))}
          </p>
        )
      })}
    </div>
  )
}
