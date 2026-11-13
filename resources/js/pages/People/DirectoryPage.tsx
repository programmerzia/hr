import { router } from '@inertiajs/react'
import { Plus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { PageHeader } from '../../components/shared/PageHeader'
import { PersonCell } from '../../components/shared/PersonCell'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Button, NativeSelect, Table, TableFooter, TableToolbar, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { useCan, useShared } from '../../inertia/props'
import type { Department, Employee, Team } from '../../types'
import { statusOptions, typeLabels, typeOptions } from './helpers'

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <NativeSelect aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="w-40">
      <option value="all">{`All ${label.toLowerCase()}${label.endsWith('s') ? 'es' : 's'}`}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  )
}

type Row = Employee & { department_name: string | null; team_name: string | null; lead_name: string | null }

interface Props {
  employees: Row[]
  departments: Department[]
  teams: Team[]
  filters: { search: string; department: string; team: string; type: string; status: string }
}

export default function DirectoryPage() {
  const { employees, departments, teams, filters } = useShared<Props>()
  const canManage = useCan('manage_people')
  const navigate = (to: string) => router.visit(to)
  const [search, setSearch] = useState(filters.search)
  const [dept, setDept] = useState(filters.department)
  const [team, setTeam] = useState(filters.team)
  const [type, setType] = useState(filters.type)
  const [status, setStatus] = useState(filters.status)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return employees
      .filter((e) => dept === 'all' || e.department_id === dept)
      .filter((e) => team === 'all' || e.team_id === team)
      .filter((e) => type === 'all' || e.employment_type === type)
      .filter((e) => status === 'all' || e.status === status)
      .filter((e) => !q || `${e.name} ${e.code} ${e.email} ${e.designation}`.toLowerCase().includes(q))
  }, [employees, search, dept, team, type, status])

  const filtered = search || dept !== 'all' || team !== 'all' || type !== 'all' || status !== 'all'
  const clear = () => {
    setSearch('')
    setDept('all')
    setTeam('all')
    setType('all')
    setStatus('all')
  }

  return (
    <div className="mx-auto max-w-content">
      <PageHeader title="People" description="Everyone at Vivacom, past and present" />
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, code or email"
        filters={
          <>
            <FilterSelect label="Department" value={dept} onChange={setDept} options={departments.map((d) => ({ value: d.id, label: d.name }))} />
            <FilterSelect label="Team" value={team} onChange={setTeam} options={teams.map((t) => ({ value: t.id, label: t.name }))} />
            <FilterSelect label="Type" value={type} onChange={setType} options={typeOptions} />
            <FilterSelect label="Status" value={status} onChange={setStatus} options={statusOptions} />
          </>
        }
        actions={
          canManage ? (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate(route('people.onboard'))}>
              Add person
            </Button>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <EmptyTable
          icon={Users}
          title={filtered ? 'No one matches these filters' : 'No people yet'}
          description={filtered ? 'Try a different search or clear the filters.' : 'Add the first person to get started.'}
          action={filtered ? <Button onClick={clear}>Clear filters</Button> : canManage ? <Button variant="primary" onClick={() => navigate(route('people.onboard'))}>Add person</Button> : undefined}
        />
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Person</Th>
              <Th>Code</Th>
              <Th>Team</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Joined</Th>
              <Th>Lead</Th>
            </tr>
          </Thead>
          <Tbody>
            {rows.map((e) => (
              <Tr
                key={e.id}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => navigate(route('people.profile', e.id))}
                onKeyDown={(ev) => ev.key === 'Enter' && navigate(route('people.profile', e.id))}
              >
                <Td><PersonCell name={e.name} subtitle={e.designation} /></Td>
                <Td className="font-mono text-fg-muted">{e.code}</Td>
                <Td>{e.team_name ?? <span className="text-fg-subtle">None</span>}</Td>
                <Td>{typeLabels[e.employment_type]}</Td>
                <Td><StatusBadge status={e.status} /></Td>
                <Td className="text-fg-muted">{formatDate(e.joined_on)}</Td>
                <Td>{e.lead_name ?? <span className="text-fg-subtle">None</span>}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      <TableFooter count={rows.length} noun={rows.length === 1 ? 'person' : 'people'} />
    </div>
  )
}
