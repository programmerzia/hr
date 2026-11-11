import { useForm } from '@inertiajs/react'
import { Button, Dialog, Field, Input, NativeSelect, Textarea } from '../../components/ui'
import { useShared } from '../../inertia/props'
import type { TaskPriority } from '../../types'
import { priorityLabels, priorityOrder, usePersonName, type ProjectScreenProps } from './shared'

export function NewTaskDialog({ columnId, onClose }: { columnId?: string; onClose: () => void }) {
  const { project, columns, members } = useShared<ProjectScreenProps>()
  const personName = usePersonName()
  const form = useForm({
    project_id: project.id,
    title: '',
    body_md: '',
    column_id: columnId ?? columns[1]?.id ?? columns[0]?.id ?? '',
    priority: 'medium' as TaskPriority,
    assignee_id: '',
    due_on: '',
  })
  const memberIds = members.map((m) => m.employee_id)

  const submit = () => {
    if (!form.data.title.trim()) return form.setError('title', 'Enter a title.')
    form.clearErrors()
    form.transform((d) => ({ ...d, assignee_id: d.assignee_id || null, due_on: d.due_on || null }))
    form.post(route('work.tasks.store'), {
      preserveScroll: true,
      preserveState: true,
      onSuccess: onClose,
      onError: (e) => {
        if (!e.title && !e.project_id) form.setError('title', 'You cannot add tasks to this project.')
      },
    })
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Add task"
      description={`New task in ${project.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!form.data.title.trim() || form.processing}>
            Create task
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4 pb-2" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <Field label="Title" required error={form.errors.title}>
          <Input value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} autoFocus />
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={form.data.body_md} onChange={(e) => form.setData('body_md', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <NativeSelect value={form.data.column_id} onChange={(e) => form.setData('column_id', e.target.value)}>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Priority">
            <NativeSelect value={form.data.priority} onChange={(e) => form.setData('priority', e.target.value as TaskPriority)}>
              {[...priorityOrder].reverse().map((p) => (
                <option key={p} value={p}>
                  {priorityLabels[p]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Assignee">
            <NativeSelect value={form.data.assignee_id} onChange={(e) => form.setData('assignee_id', e.target.value)}>
              <option value="">Unassigned</option>
              {memberIds.map((id) => (
                <option key={id} value={id}>
                  {personName(id)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Due date">
            <Input type="date" value={form.data.due_on} onChange={(e) => form.setData('due_on', e.target.value)} />
          </Field>
        </div>
      </form>
    </Dialog>
  )
}
