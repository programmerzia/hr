import { FolderKanban, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
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
import { employees, userByEmployeeId } from '../../mock/db/people'
import { workClients } from '../../mock/db/work'
import { useAuthed } from '../../mock/session'
import { isDoneTask, useWork } from '../../mock/stores/work'
import type { BillingType } from '../../types'
import { AvatarStack, personName } from './shared'

const billingOptions: { value: BillingType; label: string }[] = [
  { value: 'internal', label: 'Internal' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'fixed', label: 'Fixed price' },
]

export function ProjectsPage() {
  const { employee, role } = useAuthed()
  const navigate = useNavigate()
  const projects = useWork((s) => s.projects)
  const members = useWork((s) => s.members)
  const tasks = useWork((s) => s.tasks)
  const columns = useWork((s) => s.columns)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [creating, setCreating] = useState(false)
  const canCreate = role === 'hr' || role === 'management' || role === 'team_lead'

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects
      .filter((p) => {
        if (role !== 'hr' && role !== 'management') {
          const mine = p.lead_employee_id === employee.id || members.some((m) => m.project_id === p.id && m.employee_id === employee.id)
          if (!mine) return false
        }
        if (status !== 'all' && p.status !== status) return false
        if (!q) return true
        return `${p.key} ${p.name} ${p.client_id ? workClients[p.client_id] ?? '' : ''}`.toLowerCase().includes(q)
      })
      .map((p) => ({
        project: p,
        memberIds: members.filter((m) => m.project_id === p.id).map((m) => m.employee_id),
        open: tasks.filter((t) => t.project_id === p.id && !isDoneTask(t, columns)).length,
      }))
  }, [projects, members, tasks, columns, search, status, role, employee.id])

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
              <Tr key={p.id} className="cursor-pointer" onClick={() => navigate(`/projects/${p.key}`)}>
                <Td className="font-mono">{p.key}</Td>
                <Td>
                  <Link to={`/projects/${p.key}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                    {p.name}
                  </Link>
                </Td>
                <Td className="text-fg-muted">{p.client_id ? (workClients[p.client_id] ?? p.client_id) : 'Internal'}</Td>
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
  const { employee, role } = useAuthed()
  const createProject = useWork((s) => s.createProject)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [billing, setBilling] = useState<BillingType>('internal')
  const [client, setClient] = useState('')
  const [lead, setLead] = useState(employee.id)
  const [error, setError] = useState<string | undefined>()
  const keys = useWork((s) => s.projects.map((p) => p.key).join(','))

  const leads = employees.filter((e) => {
    const r = userByEmployeeId(e.id)?.role
    return e.status !== 'resigned' && e.status !== 'terminated' && (r === 'team_lead' || r === 'management' || e.id === employee.id)
  })

  const submit = () => {
    const k = key.trim().toUpperCase()
    if (!name.trim()) return setError('Enter a project name.')
    if (!/^[A-Z]{2,6}$/.test(k)) return setError('Key must be 2 to 6 letters.')
    if (keys.split(',').includes(k)) return setError('That key is already used.')
    if (billing !== 'internal' && !client) return setError('Choose a client for billable projects.')
    const p = createProject({
      key: k,
      name,
      client_id: billing === 'internal' ? null : client,
      lead_employee_id: role === 'team_lead' ? employee.id : lead,
      billing_type: billing,
    })
    if (p) {
      onClose()
      navigate(`/projects/${p.key}`)
    }
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
          <Button variant="primary" onClick={submit}>
            Create project
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4 pb-2" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <Field label="Name" required error={error}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Key" hint="Used in task keys, for example PULSE-12." required>
          <Input value={key} maxLength={6} onChange={(e) => setKey(e.target.value.toUpperCase())} className="font-mono" />
        </Field>
        <Field label="Billing type">
          <NativeSelect value={billing} onChange={(e) => setBilling(e.target.value as BillingType)}>
            {billingOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {billing !== 'internal' && (
          <Field label="Client" required>
            <NativeSelect value={client} onChange={(e) => setClient(e.target.value)}>
              <option value="">Select a client</option>
              {Object.entries(workClients).map(([id, n]) => (
                <option key={id} value={id}>
                  {n}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        {role !== 'team_lead' && (
          <Field label="Lead">
            <NativeSelect value={lead} onChange={(e) => setLead(e.target.value)}>
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
