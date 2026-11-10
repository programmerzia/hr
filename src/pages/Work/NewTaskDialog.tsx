import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button, Dialog, Field, Input, NativeSelect, Textarea } from '../../components/ui'
import { priorityLabels, priorityOrder, useWork } from '../../mock/stores/work'
import type { Project, TaskPriority } from '../../types'
import { personName, useProjectColumns } from './shared'

export function NewTaskDialog({ project, columnId, onClose }: { project: Project; columnId?: string; onClose: () => void }) {
  const createTask = useWork((s) => s.createTask)
  const members = useWork((s) => s.members)
  const columns = useProjectColumns(project.id)
  const [params, setParams] = useSearchParams()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [column, setColumn] = useState(columnId ?? columns[1]?.id ?? columns[0]?.id ?? '')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [assignee, setAssignee] = useState('')
  const [due, setDue] = useState('')
  const [error, setError] = useState<string | undefined>()
  const memberIds = members.filter((m) => m.project_id === project.id).map((m) => m.employee_id)

  const submit = () => {
    if (!title.trim()) return setError('Enter a title.')
    const t = createTask({
      project_id: project.id,
      title,
      body_md: body,
      column_id: column,
      priority,
      assignee_id: assignee || null,
      due_on: due || null,
    })
    if (!t) return setError('You cannot add tasks to this project.')
    onClose()
    const next = new URLSearchParams(params)
    next.set('task', t.key)
    setParams(next)
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
          <Button variant="primary" onClick={submit} disabled={!title.trim()}>
            Create task
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4 pb-2" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <Field label="Title" required error={error}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <NativeSelect value={column} onChange={(e) => setColumn(e.target.value)}>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Priority">
            <NativeSelect value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              {[...priorityOrder].reverse().map((p) => (
                <option key={p} value={p}>
                  {priorityLabels[p]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Assignee">
            <NativeSelect value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {memberIds.map((id) => (
                <option key={id} value={id}>
                  {personName(id)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Due date">
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
      </form>
    </Dialog>
  )
}
