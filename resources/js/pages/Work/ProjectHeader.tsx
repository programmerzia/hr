import { router } from '@inertiajs/react'
import { Plus, Settings2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { PageHeader } from '../../components/shared/PageHeader'
import { Button, Tabs, TabsList, TabsTrigger } from '../../components/ui'
import { useShared } from '../../inertia/props'
import { NewTaskDialog } from './NewTaskDialog'
import { ProjectSettingsSheet } from './ProjectSettingsSheet'
import type { ProjectScreenProps } from './shared'

export function ProjectHeader({ view, extra }: { view: 'board' | 'list'; extra?: ReactNode }) {
  const { project, can_write } = useShared<ProjectScreenProps>()
  const [adding, setAdding] = useState(false)
  const [settings, setSettings] = useState(false)

  return (
    <>
      <PageHeader
        title={project.name}
        description={`${project.key}`}
        breadcrumb={[{ label: 'Projects', to: route('work.projects', undefined, false) }, { label: project.key }]}
        actions={
          <>
            {extra}
            <Button icon={<Settings2 size={16} />} onClick={() => setSettings(true)}>
              Project settings
            </Button>
            {can_write && (
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
                Add task
              </Button>
            )}
          </>
        }
        tabs={
          <Tabs
            value={view}
            onValueChange={(v) => router.get(route(v === 'board' ? 'work.board' : 'work.list', project.key))}
          >
            <TabsList>
              <TabsTrigger value="board">Board</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      {adding && <NewTaskDialog onClose={() => setAdding(false)} />}
      <ProjectSettingsSheet open={settings} onOpenChange={setSettings} />
    </>
  )
}
