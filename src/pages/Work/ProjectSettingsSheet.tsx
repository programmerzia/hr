import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Button, IconButton, Input, NativeSelect, Sheet } from '../../components/ui'
import { PersonCell } from '../../components/shared/PersonCell'
import { employees } from '../../mock/db/people'
import { useAuthed } from '../../mock/session'
import { canManageProject, useWork } from '../../mock/stores/work'
import type { Project } from '../../types'
import { personName, useProjectColumns } from './shared'

export function ProjectSettingsSheet({
  project,
  open,
  onOpenChange,
}: {
  project: Project
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { employee, role } = useAuthed()
  const s = useWork()
  const columns = useProjectColumns(project.id)
  const canManage = canManageProject(project, employee.id, role)
  const memberIds = s.members.filter((m) => m.project_id === project.id).map((m) => m.employee_id)
  const candidates = employees.filter(
    (e) => !memberIds.includes(e.id) && (e.status === 'active' || e.status === 'probation' || e.status === 'on_leave'),
  )
  const [newMember, setNewMember] = useState('')
  const [newColumn, setNewColumn] = useState('')

  const move = (index: number, delta: number) => {
    const ids = columns.map((c) => c.id)
    const [item] = ids.splice(index, 1)
    ids.splice(index + delta, 0, item)
    s.reorderColumns(project.id, ids)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Project settings" description={`${project.key} / ${project.name}`}>
      <div className="flex flex-col gap-6 p-4">
        {!canManage && (
          <p className="text-sm text-fg-muted">Only the project lead, HR and management can change members and columns.</p>
        )}
        <section className="flex flex-col gap-2" aria-label="Members">
          <h3 className="text-lg font-semibold">Members</h3>
          <ul className="flex flex-col">
            {memberIds.map((id) => (
              <li key={id} className="flex h-9 items-center justify-between gap-2">
                <PersonCell name={personName(id)} subtitle={id === project.lead_employee_id ? 'Lead' : undefined} />
                {canManage && id !== project.lead_employee_id && (
                  <IconButton label={`Remove ${personName(id)}`} size="sm" onClick={() => s.removeMember(project.id, id)}>
                    <X size={14} />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
          {canManage && (
            <div className="flex gap-2">
              <NativeSelect aria-label="Add member" value={newMember} onChange={(e) => setNewMember(e.target.value)}>
                <option value="">Select a person</option>
                {candidates.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </NativeSelect>
              <Button
                disabled={!newMember}
                onClick={() => {
                  s.addMember(project.id, newMember)
                  setNewMember('')
                }}
              >
                Add
              </Button>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2" aria-label="Columns">
          <h3 className="text-lg font-semibold">Columns</h3>
          <ul className="flex flex-col gap-1.5">
            {columns.map((c, i) => (
              <li key={c.id} className="flex items-center gap-1">
                <Input
                  aria-label={`Column ${i + 1} name`}
                  defaultValue={c.name}
                  disabled={!canManage}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== c.name) s.renameColumn(c.id, e.target.value)
                    else e.target.value = c.name
                  }}
                />
                {canManage && (
                  <>
                    <IconButton label={`Move ${c.name} up`} size="sm" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp size={14} />
                    </IconButton>
                    <IconButton label={`Move ${c.name} down`} size="sm" disabled={i === columns.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown size={14} />
                    </IconButton>
                  </>
                )}
              </li>
            ))}
          </ul>
          {canManage && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (s.addColumn(project.id, newColumn)) setNewColumn('')
              }}
            >
              <Input aria-label="New column name" placeholder="New column" value={newColumn} onChange={(e) => setNewColumn(e.target.value)} />
              <Button type="submit" icon={<Plus size={16} />} disabled={!newColumn.trim()}>
                Add
              </Button>
            </form>
          )}
        </section>
      </div>
    </Sheet>
  )
}
