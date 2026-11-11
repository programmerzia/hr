import { router } from '@inertiajs/react'
import { CheckSquare, MoreHorizontal, Plus } from 'lucide-react'
import { useMemo, useState, type DragEvent } from 'react'
import { Avatar, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, IconButton } from '../../components/ui'
import { chartColor, seriesColor } from '../../components/charts/colors'
import { useShared } from '../../inertia/props'
import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/format'
import type { BoardColumn } from '../../types'
import { NewTaskDialog } from './NewTaskDialog'
import { ProjectHeader } from './ProjectHeader'
import { TaskDrawer } from './TaskDrawer'
import {
  isOverdue,
  LabelChips,
  PriorityIcon,
  useLabelsFor,
  usePersonName,
  useTaskParam,
  type ProjectScreenProps,
  type TaskRow,
} from './shared'

interface DropTarget {
  columnId: string
  index: number
}

/** Moves a card in the local list the way the server will, so the board answers instantly. */
function placeTask(tasks: TaskRow[], taskId: string, columnId: string, position?: number): TaskRow[] {
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return tasks
  const from = task.column_id
  const ids = tasks
    .filter((t) => t.column_id === columnId && t.id !== taskId)
    .sort((a, b) => a.position - b.position)
    .map((t) => t.id)
  const at = position === undefined ? ids.length : Math.max(0, Math.min(position, ids.length))
  ids.splice(at, 0, taskId)
  const renumber = (list: TaskRow[], col: string, order: string[]) =>
    list.map((t) => (t.column_id === col ? { ...t, position: order.indexOf(t.id) } : t))
  let next = tasks.map((t) => (t.id === taskId ? { ...t, column_id: columnId } : t))
  next = renumber(next, columnId, ids)
  if (from !== columnId) {
    next = renumber(
      next,
      from,
      next.filter((t) => t.column_id === from).sort((a, b) => a.position - b.position).map((t) => t.id),
    )
  }
  return next
}

export default function BoardPage() {
  const { columns, tasks: serverTasks, can_write: canWrite } = useShared<ProjectScreenProps>()
  // Local copy for optimistic moves; any new server list replaces it.
  const [synced, setSynced] = useState(serverTasks)
  const [tasks, setTasks] = useState(serverTasks)
  if (synced !== serverTasks) {
    setSynced(serverTasks)
    setTasks(serverTasks)
  }
  const [dragId, setDragId] = useState<string | null>(null)
  const [target, setTarget] = useState<DropTarget | null>(null)
  const [addIn, setAddIn] = useState<string | null>(null)

  const moveTask = (taskId: string, columnId: string, position?: number) => {
    setTasks((t) => placeTask(t, taskId, columnId, position))
    router.post(
      route('work.tasks.move', taskId),
      { column_id: columnId, position },
      { preserveState: true, preserveScroll: true, only: ['tasks'] },
    )
  }

  const byColumn = useMemo(() => {
    const map = new Map<string, TaskRow[]>()
    columns.forEach((c) => map.set(c.id, []))
    tasks
      .slice()
      .sort((a, b) => a.position - b.position)
      .forEach((t) => map.get(t.column_id)?.push(t))
    return map
  }, [tasks, columns])

  const drop = (e: DragEvent) => {
    e.preventDefault()
    if (dragId && target) moveTask(dragId, target.columnId, target.index)
    setDragId(null)
    setTarget(null)
  }

  const overCard = (e: DragEvent, columnId: string, taskId: string) => {
    if (!dragId) return
    e.preventDefault()
    e.stopPropagation()
    if (taskId === dragId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const below = e.clientY > rect.top + rect.height / 2
    const list = (byColumn.get(columnId) ?? []).filter((t) => t.id !== dragId)
    const idx = list.findIndex((t) => t.id === taskId)
    setTarget({ columnId, index: idx + (below ? 1 : 0) })
  }

  const overColumn = (e: DragEvent, columnId: string) => {
    if (!dragId) return
    e.preventDefault()
    const list = (byColumn.get(columnId) ?? []).filter((t) => t.id !== dragId)
    setTarget((t) => (t?.columnId === columnId ? t : { columnId, index: list.length }))
  }

  return (
    <div className="mx-auto max-w-full">
      <ProjectHeader view="board" />
      <div className="-mx-1 flex items-start gap-3 overflow-x-auto px-1 pb-4">
        {columns.map((c, ci) => {
          const list = byColumn.get(c.id) ?? []
          const visible = list.filter((t) => t.id !== dragId)
          const active = target?.columnId === c.id
          return (
            <section
              key={c.id}
              aria-label={c.name}
              onDragOver={(e) => overColumn(e, c.id)}
              onDrop={drop}
              className={cn(
                'flex w-72 shrink-0 flex-col overflow-hidden rounded-md border bg-surface-2/70 transition-colors duration-150',
                active ? 'border-accent ring-2 ring-accent/30' : 'border-border',
              )}
            >
              <div className="h-0.5" style={{ backgroundColor: chartColor(seriesColor(ci)) }} aria-hidden data-testid="column-strip" />
              <header className="flex h-11 items-center justify-between px-3">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  {c.name}
                  <span className="rounded-full bg-surface px-1.5 text-xs font-medium tabular-nums text-fg-muted shadow-[inset_0_0_0_1px_rgb(var(--border))]">
                    {list.length}
                  </span>
                </h2>
                {canWrite && (
                  <IconButton label={`Add task to ${c.name}`} size="sm" onClick={() => setAddIn(c.id)}>
                    <Plus size={16} />
                  </IconButton>
                )}
              </header>
              <ul className="flex min-h-12 flex-col gap-2 px-2 pb-2">
                {list.map((t, i) => {
                  const before = list.slice(0, i).filter((x) => x.id !== dragId).length
                  return (
                    <li key={t.id} onDragOver={(e) => overCard(e, c.id, t.id)}>
                      {active && t.id !== dragId && target.index === before && <DropLine />}
                      <TaskCard
                        task={t}
                        columns={columns}
                        moveTask={moveTask}
                        draggable={canWrite}
                        dragging={t.id === dragId}
                        onDragStart={() => setDragId(t.id)}
                        onDragEnd={() => {
                          setDragId(null)
                          setTarget(null)
                        }}
                      />
                    </li>
                  )
                })}
                {active && target.index >= visible.length && <li><DropLine /></li>}
                {list.length === 0 && !active && <li className="px-1 py-3 text-center text-sm text-fg-muted">No tasks</li>}
              </ul>
            </section>
          )
        })}
      </div>
      {addIn && <NewTaskDialog columnId={addIn} onClose={() => setAddIn(null)} />}
      <TaskDrawer />
    </div>
  )
}

function DropLine() {
  return <div className="mb-2 h-0.5 rounded-full bg-accent" aria-hidden />
}

function TaskCard({
  task,
  columns,
  moveTask,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  task: TaskRow
  columns: BoardColumn[]
  moveTask: (taskId: string, columnId: string, position?: number) => void
  draggable: boolean
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const personName = usePersonName()
  const setTaskParam = useTaskParam()
  const labels = useLabelsFor(task)
  const column = columns.find((c) => c.id === task.column_id)
  const open = () => setTaskParam(task.key)

  return (
    <article
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', task.key)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'card-lift group rounded-md border border-border bg-surface p-3 shadow-xs',
        draggable && 'cursor-grab active:cursor-grabbing',
        dragging && 'opacity-80 outline-dashed outline-1 outline-accent',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs text-fg-muted">{task.key}</span>
        <div className="-mr-1.5 -mt-1.5 flex items-center gap-1">
          <PriorityIcon priority={task.priority} />
          {draggable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label={`Actions for ${task.key}`} size="sm">
                  <MoreHorizontal size={16} />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={open}>Open task</DropdownMenuItem>
                <DropdownMenuLabel>Move to</DropdownMenuLabel>
                {columns.map((c) => (
                  <DropdownMenuItem key={c.id} disabled={c.id === task.column_id} onSelect={() => moveTask(task.id, c.id)}>
                    {c.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={open}
        className="mt-1 block w-full rounded text-left text-base font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {task.title}
      </button>
      {labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          <LabelChips labels={labels} />
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 text-fg-muted">
          {task.due_on && (
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-xs',
                isOverdue(task, columns) ? 'bg-danger-soft font-medium text-danger' : 'bg-surface-2',
              )}
              title={column?.is_done ? 'Completed' : undefined}
            >
              {formatDate(task.due_on)}
            </span>
          )}
          {task.subtask_total > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckSquare size={14} aria-hidden />
              {task.subtask_done}/{task.subtask_total}
            </span>
          )}
        </div>
        {task.assignee_id ? (
          <span title={personName(task.assignee_id)}>
            <Avatar name={personName(task.assignee_id)} size="sm" />
          </span>
        ) : (
          <span className="text-fg-subtle">Unassigned</span>
        )}
      </div>
    </article>
  )
}
