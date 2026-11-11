import { router } from '@inertiajs/react'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Button, IconButton, Input, NativeSelect, Sheet } from '../../components/ui'
import { PersonCell } from '../../components/shared/PersonCell'
import { useShared } from '../../inertia/props'
import { usePersonName, type ProjectScreenProps } from './shared'

const keep = { preserveScroll: true, preserveState: true } as const

export function ProjectSettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { project, columns, members, candidates, can_manage: canManage } = useShared<ProjectScreenProps>()
  const personName = usePersonName()
  const memberIds = members.map((m) => m.employee_id)
  const [newMember, setNewMember] = useState('')
  const [newColumn, setNewColumn] = useState('')

  const move = (index: number, delta: number) => {
    const ids = columns.map((c) => c.id)
    const [item] = ids.splice(index, 1)
    ids.splice(index + delta, 0, item)
    router.post(route('work.projects.columns.reorder', project.key), { ids }, keep)
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
                  <IconButton label={`Remove ${personName(id)}`} size="sm" onClick={() => router.delete(route('work.projects.members.remove', [project.key, id]), keep)}>
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
                  router.post(route('work.projects.members.add', project.key), { employee_id: newMember }, keep)
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
                    if (e.target.value.trim() && e.target.value !== c.name) router.patch(route('work.columns.update', c.id), { name: e.target.value }, keep)
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
                if (!newColumn.trim()) return
                router.post(route('work.projects.columns.add', project.key), { name: newColumn }, keep)
                setNewColumn('')
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
