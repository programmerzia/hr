import { Plus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { PageHeader } from '../../components/shared/PageHeader'
import { PersonCell } from '../../components/shared/PersonCell'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { Button, NativeSelect, Table, TableFooter, TableToolbar, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { usePeopleStore } from '../../mock/stores/people'
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
      <option value="all">{`All ${label.toLowerCase()}s`}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  )
}

export function DirectoryPage() {
  const navigate = useNavigate()
  const people = usePeopleStore()
  const [search, setSearch] = useState('')
  const [dept, setDept] = useState('all')
  const [team, setTeam] = useState('all')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return people.employees
      .filter((e) => dept === 'all' || e.department_id === dept)
      .filter((e) => team === 'all' || e.team_id === team)
      .filter((e) => type === 'all' || e.employment_type === type)
      .filter((e) => status === 'all' || e.status === status)
      .filter((e) => !q || `${e.name} ${e.code} ${e.email} ${e.designation}`.toLowerCase().includes(q))
  }, [people.employees, search, dept, team, type, status])

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
            <FilterSelect label="Department" value={dept} onChange={setDept} options={people.departments.map((d) => ({ value: d.id, label: d.name }))} />
            <FilterSelect label="Team" value={team} onChange={setTeam} options={people.teams.map((t) => ({ value: t.id, label: t.name }))} />
            <FilterSelect label="Type" value={type} onChange={setType} options={typeOptions} />
            <FilterSelect label="Status" value={status} onChange={setStatus} options={statusOptions} />
          </>
        }
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/people/new')}>
            Add person
          </Button>
        }
      />
      {rows.length === 0 ? (
        <EmptyTable
          icon={Users}
          title={filtered ? 'No one matches these filters' : 'No people yet'}
          description={filtered ? 'Try a different search or clear the filters.' : 'Add the first person to get started.'}
          action={filtered ? <Button onClick={clear}>Clear filters</Button> : <Button variant="primary" onClick={() => navigate('/people/new')}>Add person</Button>}
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
                onClick={() => navigate(`/people/${e.id}`)}
                onKeyDown={(ev) => ev.key === 'Enter' && navigate(`/people/${e.id}`)}
              >
                <Td><PersonCell name={e.name} subtitle={e.designation} /></Td>
                <Td className="font-mono text-fg-muted">{e.code}</Td>
                <Td>{people.teamOf(e.id)?.name ?? <span className="text-fg-subtle">None</span>}</Td>
                <Td>{typeLabels[e.employment_type]}</Td>
                <Td><StatusBadge status={e.status} /></Td>
                <Td className="text-fg-muted">{formatDate(e.joined_on)}</Td>
                <Td>{people.leadOf(e.id)?.name ?? <span className="text-fg-subtle">None</span>}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      <TableFooter count={rows.length} noun={rows.length === 1 ? 'person' : 'people'} />
    </div>
  )
}
