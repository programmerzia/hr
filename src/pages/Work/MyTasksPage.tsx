import { CheckSquare } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { EmptyTable } from '../../components/shared/EmptyTable'
import { PageHeader } from '../../components/shared/PageHeader'
import { TaskKey } from '../../components/shared/TaskKey'
import { Badge, Select, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { cn } from '../../lib/cn'
import { useWork, useMyTasks } from '../../mock/stores/work'
import { DueDate, isDueSoon, isOverdue, PriorityIcon } from './shared'

export function MyTasksPage() {
  const tasks = useMyTasks()
  const projects = useWork((s) => s.projects)
  const columns = useWork((s) => s.columns)
  const moveTask = useWork((s) => s.moveTask)

  const groups = useMemo(
    () =>
      projects
        .map((p) => ({
          project: p,
          items: tasks
            .filter((t) => t.project_id === p.id)
            .sort((a, b) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999')),
        }))
        .filter((g) => g.items.length > 0),
    [projects, tasks],
  )
  const overdue = tasks.filter((t) => isOverdue(t, columns)).length

  return (
    <div className="mx-auto max-w-content">
      <PageHeader
        title="My tasks"
        description={tasks.length === 0 ? undefined : `${tasks.length} open${overdue ? `, ${overdue} overdue` : ''}`}
      />
      {groups.length === 0 ? (
        <EmptyTable icon={CheckSquare} title="No open tasks" description="Tasks assigned to you will appear here." />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(({ project, items }) => {
            const cols = columns.filter((c) => c.project_id === project.id).sort((a, b) => a.position - b.position)
            return (
              <section key={project.id} aria-label={project.name}>
                <h2 className="mb-2 text-lg font-semibold">
                  <Link to={`/projects/${project.key}`} className="hover:underline">
                    {project.name}
                  </Link>{' '}
                  <span className="font-mono text-sm font-normal text-fg-muted">{project.key}</span>
                </h2>
                <Table>
                  <Thead>
                    <tr>
                      <Th>Key</Th>
                      <Th>Title</Th>
                      <Th>Priority</Th>
                      <Th>Due</Th>
                      <Th>Status</Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    {items.map((t) => {
                      const late = isOverdue(t, columns)
                      const soon = isDueSoon(t, columns)
                      return (
                        <Tr key={t.id} className={cn(late && 'bg-danger-soft/40', soon && 'bg-warning-soft/40')}>
                          <Td>
                            <TaskKey taskKey={t.key} />
                          </Td>
                          <Td className="font-medium">{t.title}</Td>
                          <Td>
                            <PriorityIcon priority={t.priority} withLabel />
                          </Td>
                          <Td className="whitespace-nowrap">
                            <DueDate task={t} columns={columns} />{' '}
                            {late && <Badge variant="danger">Overdue</Badge>}
                            {soon && <Badge variant="warning">Due soon</Badge>}
                          </Td>
                          <Td className="w-44">
                            <Select
                              aria-label={`Status of ${t.key}`}
                              value={t.column_id}
                              onValueChange={(v) => moveTask(t.id, v)}
                              options={cols.map((c) => ({ value: c.id, label: c.name }))}
                              className="h-7"
                            />
                          </Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
