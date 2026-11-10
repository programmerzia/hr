import { CheckSquare, FolderKanban, MoreHorizontal, Plus } from 'lucide-react'
import { useMemo, useState, type DragEvent } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { Avatar, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, IconButton } from '../../components/ui'
import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/format'
import { useAuthed } from '../../mock/session'
import { canManageProject, useWork } from '../../mock/stores/work'
import type { BoardColumn, Project, Task } from '../../types'
import { NewTaskDialog } from './NewTaskDialog'
import { ProjectHeader } from './ProjectHeader'
import { isOverdue, LabelChips, personName, PriorityIcon, useLabelsFor, useProjectByKey, useProjectColumns } from './shared'

interface DropTarget {
  columnId: string
  index: number
}

export function BoardPage() {
  const { key } = useParams()
  const project = useProjectByKey(key)
  if (!project) {
    return (
      <div className="mx-auto max-w-content">
        <EmptyTable icon={FolderKanban} title="Project not found" description={`No project with key ${key ?? ''} exists.`} />
      </div>
    )
  }
  return <Board project={project} />
}

function Board({ project }: { project: Project }) {
  const { employee, role } = useAuthed()
  const columns = useProjectColumns(project.id)
  const tasks = useWork((s) => s.tasks)
  const members = useWork((s) => s.members)
  const moveTask = useWork((s) => s.moveTask)
  const [dragId, setDragId] = useState<string | null>(null)
  const [target, setTarget] = useState<DropTarget | null>(null)
  const [addIn, setAddIn] = useState<string | null>(null)
  const canWrite =
    canManageProject(project, employee.id, role) || members.some((m) => m.project_id === project.id && m.employee_id === employee.id)

  const byColumn = useMemo(() => {
    const map = new Map<string, Task[]>()
    columns.forEach((c) => map.set(c.id, []))
    tasks
      .filter((t) => t.project_id === project.id)
      .sort((a, b) => a.position - b.position)
      .forEach((t) => map.get(t.column_id)?.push(t))
    return map
  }, [tasks, columns, project.id])

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
      <ProjectHeader project={project} view="board" />
      <div className="-mx-1 flex items-start gap-3 overflow-x-auto px-1 pb-4">
        {columns.map((c) => {
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
                'flex w-72 shrink-0 flex-col rounded-md border bg-surface-2 transition-colors duration-150',
                active ? 'border-accent' : 'border-border',
              )}
            >
              <header className="flex h-10 items-center justify-between px-3">
                <h2 className="text-base font-semibold">
                  {c.name} <span className="font-normal text-fg-muted">{list.length}</span>
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
      {addIn && <NewTaskDialog project={project} columnId={addIn} onClose={() => setAddIn(null)} />}
    </div>
  )
}

function DropLine() {
  return <div className="mb-2 h-0.5 rounded-full bg-accent" aria-hidden />
}

function TaskCard({
  task,
  columns,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  task: Task
  columns: BoardColumn[]
  draggable: boolean
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const [params, setParams] = useSearchParams()
  const labels = useLabelsFor(task.id)
  const subs = useWork((s) => s.subtasks)
  const moveTask = useWork((s) => s.moveTask)
  const mine = subs.filter((x) => x.task_id === task.id)
  const done = mine.filter((x) => x.done).length
  const column = columns.find((c) => c.id === task.column_id)

  const open = () => {
    const next = new URLSearchParams(params)
    next.set('task', task.key)
    setParams(next)
  }

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
        'group rounded-md border border-border bg-surface p-3 hover:border-border-strong',
        draggable && 'cursor-grab active:cursor-grabbing',
        dragging && 'opacity-40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-sm text-fg-muted">{task.key}</span>
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
            <span className={cn(isOverdue(task, columns) && 'font-medium text-danger')} title={column?.is_done ? 'Completed' : undefined}>
              {formatDate(task.due_on)}
            </span>
          )}
          {mine.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckSquare size={14} aria-hidden />
              {done}/{mine.length}
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
