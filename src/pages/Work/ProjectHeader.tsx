import { Plus, Settings2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button, Tabs, TabsList, TabsTrigger } from '../../components/ui'
import { useAuthed } from '../../mock/session'
import { canManageProject } from '../../mock/stores/work'
import type { Project } from '../../types'
import { NewTaskDialog } from './NewTaskDialog'
import { ProjectSettingsSheet } from './ProjectSettingsSheet'
import { useWork } from '../../mock/stores/work'

export function ProjectHeader({ project, view, extra }: { project: Project; view: 'board' | 'list'; extra?: ReactNode }) {
  const { employee, role } = useAuthed()
  const navigate = useNavigate()
  const isMember = useWork((s) => s.members.some((m) => m.project_id === project.id && m.employee_id === employee.id))
  const canAdd = isMember || canManageProject(project, employee.id, role)
  const [adding, setAdding] = useState(false)
  const [settings, setSettings] = useState(false)

  return (
    <>
      <PageHeader
        title={project.name}
        description={`${project.key}`}
        breadcrumb={[{ label: 'Projects', to: '/projects' }, { label: project.key }]}
        actions={
          <>
            {extra}
            <Button icon={<Settings2 size={16} />} onClick={() => setSettings(true)}>
              Project settings
            </Button>
            {canAdd && (
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
                Add task
              </Button>
            )}
          </>
        }
        tabs={
          <Tabs value={view} onValueChange={(v) => navigate(v === 'board' ? `/projects/${project.key}` : `/projects/${project.key}/list`)}>
            <TabsList>
              <TabsTrigger value="board">Board</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      {adding && <NewTaskDialog project={project} onClose={() => setAdding(false)} />}
      <ProjectSettingsSheet project={project} open={settings} onOpenChange={setSettings} />
    </>
  )
}
