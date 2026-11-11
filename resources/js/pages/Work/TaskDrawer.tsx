import { Link, router } from '@inertiajs/react'
import { Check, ImagePlus, Pencil, Plus } from 'lucide-react'
import { useState, type ClipboardEvent } from 'react'
import { HistoryPanel } from '../../components/shared/HistoryPanel'
import {
  Button,
  Checkbox,
  EmptyState,
  Field,
  IconButton,
  Input,
  Progress,
  Select,
  Sheet,
  Textarea,
  type SelectOption,
} from '../../components/ui'
import { useShared } from '../../inertia/props'
import { cn } from '../../lib/cn'
import { formatDuration, relativeTime } from '../../lib/format'
import type { TaskPriority } from '../../types'
import { Markdown, priorityLabels, priorityOrder, usePersonName, useTaskParam, type DrawerTask } from './shared'

const priorityOptions: SelectOption[] = [...priorityOrder].reverse().map((p) => ({ value: p, label: priorityLabels[p] }))

const keep = { preserveScroll: true, preserveState: true } as const

interface PendingFile {
  file: File
  url: string
}

/** Opens when the server sent a `task` prop (`?task=KEY` in the URL). Mount once per Work page. */
export function TaskDrawer() {
  const { task, task_key: key } = useShared<{ task: DrawerTask | null; task_key: string | null }>()
  const setTaskParam = useTaskParam()
  const close = () => setTaskParam(null)

  if (!key) return null
  if (!task) {
    return (
      <Sheet open onOpenChange={(o) => !o && close()} title={key} className="max-w-xl">
        <EmptyState title="Task not found" description={`No task with key ${key} exists.`} />
      </Sheet>
    )
  }
  return <TaskDrawerBody key={task.id} task={task} onClose={close} />
}

function TaskDrawerBody({ task, onClose }: { task: DrawerTask; onClose: () => void }) {
  const personName = usePersonName()
  const serverTime = useShared().attendance.server_time
  const { project, columns, labels: availableLabels, member_ids: memberIds, can_edit: canEdit } = task
  const update = (data: Record<string, unknown>) => router.patch(route('work.tasks.update', task.id), data as never, keep)
  const moveTask = (columnId: string) => router.post(route('work.tasks.move', task.id), { column_id: columnId }, keep)

  const [editingBody, setEditingBody] = useState(false)
  const [body, setBody] = useState(task.body_md)
  const [title, setTitle] = useState(task.title)
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const [comment, setComment] = useState('')
  const [pending, setPending] = useState<PendingFile[]>([])

  const subs = [...task.subtasks].sort((a, b) => a.position - b.position)
  const taskFiles = task.attachments.filter((a) => a.attachable_type === 'task')
  const comments = task.comments
  // Relative times are measured against the server clock, not the browser's.
  const serverNow = new Date(serverTime)
  const activity = task.activity.map((a) => ({ at: a.at, actor: personName(a.actor_id), text: a.text }))

  const tracked = task.tracked_seconds
  const estimateSeconds = (task.estimate_minutes ?? 0) * 60
  const taskLabelIds = new Set(task.label_ids)

  const assigneeOptions: SelectOption[] = [
    { value: 'none', label: 'Unassigned' },
    ...memberIds.map((id) => ({ value: id, label: personName(id) })),
  ]
  if (task.assignee_id && !memberIds.includes(task.assignee_id))
    assigneeOptions.push({ value: task.assignee_id, label: personName(task.assignee_id) })

  const onPaste = (e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    e.preventDefault()
    setPending((p) => [...p, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))])
  }

  const submitComment = () => {
    router.post(
      route('work.tasks.comments', task.id),
      { body: comment, files: pending.map((p) => p.file) },
      {
        ...keep,
        forceFormData: true,
        onSuccess: () => {
          pending.forEach((p) => URL.revokeObjectURL(p.url))
          setComment('')
          setPending([])
        },
      },
    )
  }

  const commentFiles = (id: string) => task.attachments.filter((a) => a.attachable_type === 'task_comment' && a.attachable_id === id)

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={`${task.key} ${task.title}`} hideTitle className="max-w-xl">
      <div className="flex flex-col gap-6 p-4">
        <header className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-sm text-fg-muted">
            <span className="font-mono text-fg">{task.key}</span>
            <span aria-hidden>/</span>
            <Link href={route('work.board', project.key)} className="hover:text-fg hover:underline">
              {project.name}
            </Link>
          </p>
          <Input
            aria-label="Title"
            value={title}
            disabled={!canEdit}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => (title.trim() ? title !== task.title && update({ title }) : setTitle(task.title))}
            className="h-9 border-transparent px-1 text-lg font-semibold hover:border-border-strong"
          />
        </header>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Status">
            <Select
              value={task.column_id}
              disabled={!canEdit}
              onValueChange={(v) => moveTask(v)}
              options={columns.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Priority">
            <Select
              value={task.priority}
              disabled={!canEdit}
              onValueChange={(v) => update({ priority: v as TaskPriority })}
              options={priorityOptions}
            />
          </Field>
          <Field label="Assignee">
            <Select
              value={task.assignee_id ?? 'none'}
              disabled={!canEdit}
              onValueChange={(v) => update({ assignee_id: v === 'none' ? null : v })}
              options={assigneeOptions}
            />
          </Field>
          <Field label="Due date">
            <Input
              type="date"
              value={task.due_on ?? ''}
              disabled={!canEdit}
              onChange={(e) => update({ due_on: e.target.value || null })}
            />
          </Field>
          <Field label="Estimate (hours)">
            <Input
              type="number"
              min={0}
              step={0.5}
              disabled={!canEdit}
              defaultValue={task.estimate_minutes === null ? '' : task.estimate_minutes / 60}
              onBlur={(e) =>
                update({ estimate_minutes: e.target.value === '' ? null : Math.round(Number(e.target.value) * 60) })
              }
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Tracked</span>
            <p className="text-base">
              <span className="font-mono tabular-nums">{formatDuration(tracked)}</span>
              <span className="text-fg-muted">
                {' '}
                of {task.estimate_minutes === null ? 'no estimate' : formatDuration(estimateSeconds)}
              </span>
            </p>
            {estimateSeconds > 0 && (
              <Progress value={tracked} max={estimateSeconds} tone={tracked > estimateSeconds ? 'danger' : 'accent'} aria-label="Tracked time against estimate" />
            )}
          </div>
        </div>

        <section aria-label="Labels" className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">Labels</h3>
          <div className="flex flex-wrap gap-1.5">
            {availableLabels.map((l) => {
              const on = taskLabelIds.has(l.id)
              return (
                <button
                  key={l.id}
                  type="button"
                  disabled={!canEdit}
                  aria-pressed={on}
                  onClick={() =>
                    update({ label_ids: on ? [...taskLabelIds].filter((x) => x !== l.id) : [...taskLabelIds, l.id] })
                  }
                  className={cn(
                    'inline-flex h-6 items-center gap-1 rounded border px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60',
                    on ? 'border-accent bg-accent-soft text-accent' : 'border-border-strong text-fg-muted hover:text-fg',
                  )}
                >
                  {on && <Check size={12} />}
                  {l.name}
                </button>
              )
            })}
          </div>
        </section>

        <section aria-label="Description" className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Description</h3>
            {canEdit && !editingBody && (
              <IconButton label="Edit description" size="sm" onClick={() => { setBody(task.body_md); setEditingBody(true) }}>
                <Pencil size={14} />
              </IconButton>
            )}
          </div>
          {editingBody ? (
            <div className="flex flex-col gap-2">
              <Textarea
                aria-label="Description"
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Supports paragraphs, - lists, `code` and **bold**."
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingBody(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    update({ body_md: body })
                    setEditingBody(false)
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : task.body_md.trim() ? (
            <Markdown source={task.body_md} />
          ) : (
            <p className="text-sm text-fg-muted">No description.</p>
          )}
        </section>

        <section aria-label="Subtasks" className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">
            Subtasks{' '}
            {subs.length > 0 && (
              <span className="font-normal text-fg-muted">
                {subs.filter((x) => x.done).length}/{subs.length}
              </span>
            )}
          </h3>
          {subs.length === 0 && <p className="text-sm text-fg-muted">No subtasks.</p>}
          <ul className="flex flex-col gap-1">
            {subs.map((x) => (
              <li key={x.id}>
                <Checkbox
                  checked={x.done}
                  disabled={!canEdit}
                  onCheckedChange={() => router.post(route('work.subtasks.toggle', x.id), {}, keep)}
                  label={<span className={x.done ? 'text-fg-muted line-through' : ''}>{x.title}</span>}
                />
              </li>
            ))}
          </ul>
          {canEdit && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                router.post(route('work.tasks.subtasks.store', task.id), { title: subtaskTitle }, keep)
                setSubtaskTitle('')
              }}
            >
              <Input aria-label="New subtask" placeholder="Add a subtask" value={subtaskTitle} onChange={(e) => setSubtaskTitle(e.target.value)} />
              <Button type="submit" icon={<Plus size={16} />} disabled={!subtaskTitle.trim()}>
                Add
              </Button>
            </form>
          )}
        </section>

        <section aria-label="Attachments" className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">Attachments</h3>
          {taskFiles.length === 0 ? (
            <p className="text-sm text-fg-muted">No attachments. Paste an image into the comment box to add one.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2">
              {taskFiles.map((a) => (
                <li key={a.id} className="overflow-hidden rounded-md border border-border">
                  <img src={a.path} alt={a.name} className="h-20 w-full object-cover" />
                  <p className="truncate px-2 py-1 text-xs text-fg-muted">{a.name}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Comments" className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold">Comments</h3>
          {comments.length === 0 && <p className="text-sm text-fg-muted">No comments yet.</p>}
          <ul className="flex flex-col gap-3">
            {comments.map((c) => (
              <li key={c.id} className="text-sm">
                <p>
                  <span className="font-medium">{personName(c.author_id)}</span>{' '}
                  <span className="text-xs text-fg-subtle">{relativeTime(c.created_at, serverNow)}</span>
                </p>
                {c.body && <Markdown source={c.body} className="text-base" />}
                {commentFiles(c.id).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {commentFiles(c.id).map((a) => (
                      <img key={a.id} src={a.path} alt={a.name} className="max-h-32 rounded-md border border-border" />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {canEdit ? (
            <div className="flex flex-col gap-2">
              <Textarea
                aria-label="Comment"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onPaste={onPaste}
                placeholder="Write a comment. Paste a screenshot to attach it."
              />
              {pending.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pending.map((a, i) => (
                    <div key={i} className="relative">
                      <img src={a.url} alt={a.file.name} className="h-16 rounded border border-border" />
                      <button
                        type="button"
                        aria-label={`Remove ${a.file.name}`}
                        onClick={() => {
                          URL.revokeObjectURL(a.url)
                          setPending((p) => p.filter((_, j) => j !== i))
                        }}
                        className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-fg text-xs text-surface"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
                  <ImagePlus size={14} /> Paste images to attach
                </span>
                <Button variant="primary" size="sm" disabled={!comment.trim() && pending.length === 0} onClick={submitComment}>
                  Comment
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-fg-muted">Only project members can comment.</p>
          )}
        </section>

        <HistoryPanel title="Activity" entries={activity} now={serverNow} />
      </div>
    </Sheet>
  )
}
