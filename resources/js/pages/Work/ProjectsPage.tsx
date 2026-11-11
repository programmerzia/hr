import { Link, router, useForm } from '@inertiajs/react'
import { FolderKanban, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { PageHeader } from '../../components/shared/PageHeader'
import { PersonCell } from '../../components/shared/PersonCell'
import { StatusBadge } from '../../components/shared/StatusBadge'
import {
  Button,
  Dialog,
  Field,
  Input,
  NativeSelect,
  Select,
  Table,
  TableFooter,
  TableToolbar,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui'
import { useAuth, useShared } from '../../inertia/props'
import type { BillingType } from '../../types'
import { AvatarStack, usePersonName, type Person, type ProjectRow } from './shared'

interface ProjectsProps {
  projects: (ProjectRow & { member_ids: string[]; open_tasks: number })[]
  clients: Person[]
  lead_options: Person[]
  can_create: boolean
}

const billingOptions: { value: BillingType; label: string }[] = [
  { value: 'internal', label: 'Internal' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'fixed', label: 'Fixed price' },
]

export default function ProjectsPage() {
  const { projects, can_create: canCreate } = useShared<ProjectsProps>()
  const personName = usePersonName()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [creating, setCreating] = useState(false)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects
      .filter((p) => {
        if (status !== 'all' && p.status !== status) return false
        if (!q) return true
        return `${p.key} ${p.name} ${p.client_name ?? ''}`.toLowerCase().includes(q)
      })
      .map((p) => ({ project: p, memberIds: p.member_ids, open: p.open_tasks }))
  }, [projects, search, status])

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="Projects"
        actions={
          canCreate && (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              New project
            </Button>
          )
        }
      />
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search projects"
        filters={
          <Select
            aria-label="Status"
            className="w-36"
            value={status}
            onValueChange={setStatus}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
              { value: 'done', label: 'Done' },
            ]}
          />
        }
      />
      {rows.length === 0 ? (
        <EmptyTable
          icon={FolderKanban}
          title="No projects found"
          description={search || status !== 'all' ? 'Try a different search or status.' : 'You are not a member of any project yet.'}
        />
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Key</Th>
              <Th>Name</Th>
              <Th>Client</Th>
              <Th>Lead</Th>
              <Th>Members</Th>
              <Th numeric>Open tasks</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <Tbody>
            {rows.map(({ project: p, memberIds, open }) => (
              <Tr key={p.id} className="cursor-pointer" onClick={() => router.get(route('work.board', p.key))}>
                <Td className="font-mono">{p.key}</Td>
                <Td>
                  <Link href={route('work.board', p.key)} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                    {p.name}
                  </Link>
                </Td>
                <Td className="text-fg-muted">{p.client_name ?? 'Internal'}</Td>
                <Td>
                  <PersonCell name={personName(p.lead_employee_id)} />
                </Td>
                <Td>
                  <AvatarStack ids={memberIds} />
                </Td>
                <Td numeric>{open}</Td>
                <Td>
                  <StatusBadge status={p.status} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      <TableFooter count={rows.length} noun={rows.length === 1 ? 'project' : 'projects'} />
      {creating && <NewProjectDialog onClose={() => setCreating(false)} />}
    </div>
  )
}

function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const { employee, role } = useAuth()
  const { clients, lead_options: leads, projects } = useShared<ProjectsProps>()
  const form = useForm({
    name: '',
    key: '',
    billing_type: 'internal' as BillingType,
    client_id: '',
    lead_employee_id: employee.id,
  })
  const { name, key, billing_type: billing } = form.data
  const error = form.errors.name ?? form.errors.key ?? form.errors.client_id

  const submit = () => {
    const k = key.trim().toUpperCase()
    form.clearErrors()
    if (!name.trim()) return form.setError('name', 'Enter a project name.')
    if (!/^[A-Z]{2,6}$/.test(k)) return form.setError('name', 'Key must be 2 to 6 letters.')
    if (projects.some((p) => p.key === k)) return form.setError('name', 'That key is already used.')
    if (billing !== 'internal' && !form.data.client_id) return form.setError('name', 'Choose a client for billable projects.')
    form.transform((d) => ({ ...d, key: k, client_id: billing === 'internal' ? null : d.client_id }))
    form.post(route('work.projects.store'), { onSuccess: onClose })
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="New project"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!name.trim() || !key.trim() || form.processing}>
            Create project
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4 pb-2" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <Field label="Name" required error={error}>
          <Input value={name} onChange={(e) => form.setData('name', e.target.value)} />
        </Field>
        <Field label="Key" hint="Used in task keys, for example PULSE-12." required>
          <Input value={key} maxLength={6} onChange={(e) => form.setData('key', e.target.value.toUpperCase())} className="font-mono" />
        </Field>
        <Field label="Billing type">
          <NativeSelect value={billing} onChange={(e) => form.setData('billing_type', e.target.value as BillingType)}>
            {billingOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {billing !== 'internal' && (
          <Field label="Client" required>
            <NativeSelect value={form.data.client_id} onChange={(e) => form.setData('client_id', e.target.value)}>
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        {role !== 'team_lead' && (
          <Field label="Lead">
            <NativeSelect value={form.data.lead_employee_id} onChange={(e) => form.setData('lead_employee_id', e.target.value)}>
              {leads.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </form>
    </Dialog>
  )
}
