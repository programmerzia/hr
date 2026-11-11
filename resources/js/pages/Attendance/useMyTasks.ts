import { useWork } from '../../mock/stores/work'

/** Minimal task shape this module needs; the Work module's Task is a superset. */
export interface TaskRef {
  id: string
  key: string
  title: string
}

export interface WorkTask extends TaskRef {
  assignee_id?: string | null
}

/** All tasks known to the Work module. */
export function useWorkTasks(): WorkTask[] {
  return useWork((s) => s.tasks)
}

/** Tasks assigned to the employee, as `{ id, key, title }`. */
export function useMyTasks(employeeId: string): TaskRef[] {
  const all = useWorkTasks()
  return all
    .filter((t) => t.assignee_id === employeeId)
    .map((t) => ({ id: t.id, key: t.key, title: t.title }))
}
