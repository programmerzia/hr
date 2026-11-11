import { useMemo, useState } from 'react'
import { Avatar, Button, Checkbox, Dialog, EmptyState, Field, Input, SegmentedControl } from '../../components/ui'
import { usePeopleStore } from '../../mock/stores/people'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  selfId: string
  onDirect: (otherId: string) => void
  onGroup: (name: string, memberIds: string[]) => void
}

export function NewMessageDialog({ open, onOpenChange, selfId, onDirect, onGroup }: Props) {
  const employees = usePeopleStore((s) => s.employees)
  const [mode, setMode] = useState<'direct' | 'group'>('direct')
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string[]>([])

  const people = useMemo(
    () =>
      employees
        .filter((e) => e.id !== selfId && e.exited_on === null && e.name.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [employees, selfId, query],
  )

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setQuery('')
      setName('')
      setPicked([])
      setMode('direct')
    }
  }

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const canCreate = name.trim().length > 0 && picked.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="New message"
      description="Message one person or start a group."
      footer={
        mode === 'group' ? (
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!canCreate}
              onClick={() => {
                onGroup(name, [selfId, ...picked])
                close(false)
              }}
            >
              Create group
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-3">
        <SegmentedControl
          aria-label="Message type"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'direct', label: 'Direct' },
            { value: 'group', label: 'Group' },
          ]}
        />
        {mode === 'group' && (
          <Field label="Group name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Release 2.5 planning" />
          </Field>
        )}
        <Field label={mode === 'group' ? 'Members' : 'Person'}>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" />
        </Field>
        <ul className="max-h-64 overflow-y-auto rounded-md border border-border">
          {people.length === 0 && (
            <li>
              <EmptyState title="No one found" description="Try a different name." className="py-6" />
            </li>
          )}
          {people.map((e) => (
            <li key={e.id} className="border-b border-border last:border-b-0">
              {mode === 'direct' ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  onClick={() => {
                    onDirect(e.id)
                    close(false)
                  }}
                >
                  <Avatar name={e.name} size="sm" />
                  <span className="font-medium">{e.name}</span>
                  <span className="truncate text-fg-muted">{e.designation}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2">
                  <Checkbox
                    aria-label={e.name}
                    checked={picked.includes(e.id)}
                    onCheckedChange={() => toggle(e.id)}
                  />
                  <Avatar name={e.name} size="sm" />
                  <span className="font-medium">{e.name}</span>
                  <span className="truncate text-fg-muted">{e.designation}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  )
}
