import { ListChecks } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { PersonCell } from '../../components/shared/PersonCell'
import { TaskKey } from '../../components/shared/TaskKey'
import { Button, Select, SegmentedControl, Table, TableFooter, TableToolbar, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { formatDuration } from '../../lib/format'
import { useShared } from '../../inertia/props'
import { ProjectHeader } from './ProjectHeader'
import { TaskDrawer } from './TaskDrawer'
import {
  DueDate,
  LabelChips,
  priorityLabels,
  priorityOrder,
  PriorityIcon,
  useLabelsFor,
  usePersonName,
  useTaskParam,
  type ProjectScreenProps,
  type TaskRow,
} from './shared'

type Task = TaskRow
type SortKey = 'key' | 'title' | 'status' | 'priority' | 'assignee' | 'due' | 'estimate'
type GroupBy = 'none' | 'status' | 'assignee' | 'priority'

function RowLabels({ task }: { task: TaskRow }) {
  const labels = useLabelsFor(task)
  return (
    <div className="flex gap-1">
      <LabelChips labels={labels} />
    </div>
  )
}

export default function ListPage() {
  const { columns, tasks, labels, members } = useShared<ProjectScreenProps>()
  const personName = usePersonName()
  const setTaskParam = useTaskParam()
  const [search, setSearch] = useState('')
  const [assignee, setAssignee] = useState('all')
  const [priority, setPriority] = useState('all')
  const [label, setLabel] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'key', dir: 'asc' })
  const [group, setGroup] = useState<GroupBy>('none')

  const colIndex = useMemo(() => new Map(columns.map((c, i) => [c.id, i])), [columns])
  const memberIds = members.map((m) => m.employee_id)
  const filtering = search || assignee !== 'all' || priority !== 'all' || label !== 'all' || status !== 'all'

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = tasks.filter((t) => {
      if (q && !`${t.key} ${t.title}`.toLowerCase().includes(q)) return false
      if (assignee === 'none' ? t.assignee_id !== null : assignee !== 'all' && t.assignee_id !== assignee) return false
      if (priority !== 'all' && t.priority !== priority) return false
      if (status !== 'all' && t.column_id !== status) return false
      if (label !== 'all' && !t.label_ids.includes(label)) return false
      return true
    })
    const val = (t: Task): string | number => {
      switch (sort.key) {
        case 'key': return t.number
        case 'title': return t.title.toLowerCase()
        case 'status': return colIndex.get(t.column_id) ?? 0
        case 'priority': return priorityOrder.indexOf(t.priority)
        case 'assignee': return personName(t.assignee_id).toLowerCase()
        case 'due': return t.due_on ?? '9999'
        case 'estimate': return t.estimate_minutes ?? -1
      }
    }
    const dir = sort.dir === 'asc' ? 1 : -1
    return list.sort((a, b) => {
      const x = val(a)
      const y = val(b)
      return (x < y ? -1 : x > y ? 1 : 0) * dir
    })
  }, [tasks, search, assignee, priority, status, label, sort, colIndex, personName])

  const groups = useMemo(() => {
    if (group === 'none') return [{ id: 'all', title: '', items: rows }]
    const map = new Map<string, { id: string; title: string; items: Task[] }>()
    const add = (id: string, title: string, t: Task) => {
      const g = map.get(id) ?? { id, title, items: [] }
      g.items.push(t)
      map.set(id, g)
    }
    rows.forEach((t) => {
      if (group === 'status') add(t.column_id, columns.find((c) => c.id === t.column_id)?.name ?? '', t)
      if (group === 'priority') add(t.priority, priorityLabels[t.priority], t)
      if (group === 'assignee') add(t.assignee_id ?? 'none', personName(t.assignee_id), t)
    })
    const order = (g: { id: string }) =>
      group === 'status' ? (colIndex.get(g.id) ?? 99) : group === 'priority' ? priorityOrder.indexOf(g.id as Task['priority']) : 0
    return [...map.values()].sort((a, b) => order(a) - order(b) || a.title.localeCompare(b.title))
  }, [rows, group, columns, colIndex, personName])

  const th = (k: SortKey, text: string, numeric?: boolean) => (
    <Th
      numeric={numeric}
      sort={sort.key === k ? sort.dir : null}
      onSort={() => setSort((s) => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }))}
    >
      {text}
    </Th>
  )

  const clear = () => {
    setSearch('')
    setAssignee('all')
    setPriority('all')
    setLabel('all')
    setStatus('all')
  }

  const open = (key: string) => setTaskParam(key)

  return (
    <div className="mx-auto max-w-full">
      <ProjectHeader view="list" />
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search tasks"
        filters={
          <>
            <Select aria-label="Status" className="w-36" value={status} onValueChange={setStatus} options={[{ value: 'all', label: 'All statuses' }, ...columns.map((c) => ({ value: c.id, label: c.name }))]} />
            <Select aria-label="Assignee" className="w-40" value={assignee} onValueChange={setAssignee} options={[{ value: 'all', label: 'Any assignee' }, { value: 'none', label: 'Unassigned' }, ...memberIds.map((id) => ({ value: id, label: personName(id) }))]} />
            <Select aria-label="Priority" className="w-36" value={priority} onValueChange={setPriority} options={[{ value: 'all', label: 'Any priority' }, ...priorityOrder.map((p) => ({ value: p, label: priorityLabels[p] }))]} />
            <Select aria-label="Label" className="w-36" value={label} onValueChange={setLabel} options={[{ value: 'all', label: 'Any label' }, ...labels.map((l) => ({ value: l.id, label: l.name }))]} />
            {filtering && (
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear filters
              </Button>
            )}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-fg-muted">Group by</span>
            <SegmentedControl
              aria-label="Group by"
              value={group}
              onValueChange={setGroup}
              options={[
                { value: 'none', label: 'None' },
                { value: 'status', label: 'Status' },
                { value: 'assignee', label: 'Assignee' },
                { value: 'priority', label: 'Priority' },
              ]}
            />
          </div>
        }
      />
      {rows.length === 0 ? (
        <EmptyTable
          icon={ListChecks}
          title="No tasks found"
          description={filtering ? 'No task matches these filters.' : 'This project has no tasks yet.'}
          action={filtering ? <Button onClick={clear}>Clear filters</Button> : undefined}
        />
      ) : (
        <Table>
          <Thead>
            <tr>
              {th('key', 'Key')}
              {th('title', 'Title')}
              {th('status', 'Status')}
              {th('priority', 'Priority')}
              {th('assignee', 'Assignee')}
              {th('due', 'Due')}
              {th('estimate', 'Estimate', true)}
              <Th>Labels</Th>
            </tr>
          </Thead>
          <Tbody>
            {groups.map((g) => (
              <Fragment key={g.id}>
                {group !== 'none' && (
                  <tr className="border-b border-border bg-surface-2">
                    <td colSpan={8} className="h-8 px-3 text-sm font-medium">
                      {g.title} <span className="font-normal text-fg-muted">{g.items.length}</span>
                    </td>
                  </tr>
                )}
                {g.items.map((t) => (
                  <Tr key={t.id} className="cursor-pointer" onClick={() => open(t.key)}>
                    <Td onClick={(e) => e.stopPropagation()}>
                      <TaskKey taskKey={t.key} />
                    </Td>
                    <Td className="max-w-md truncate font-medium">{t.title}</Td>
                    <Td className="text-fg-muted">{columns.find((c) => c.id === t.column_id)?.name}</Td>
                    <Td>
                      <PriorityIcon priority={t.priority} withLabel />
                    </Td>
                    <Td>{t.assignee_id ? <PersonCell name={personName(t.assignee_id)} /> : <span className="text-fg-subtle">Unassigned</span>}</Td>
                    <Td className="whitespace-nowrap">
                      <DueDate task={t} columns={columns} />
                    </Td>
                    <Td numeric>{t.estimate_minutes === null ? '' : formatDuration(t.estimate_minutes * 60)}</Td>
                    <Td>
                      <RowLabels task={t} />
                    </Td>
                  </Tr>
                ))}
              </Fragment>
            ))}
          </Tbody>
        </Table>
      )}
      <TableFooter count={rows.length} noun={rows.length === 1 ? 'task' : 'tasks'} />
      <TaskDrawer />
    </div>
  )
}
