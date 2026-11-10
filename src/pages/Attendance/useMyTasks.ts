import { useEffect, useState } from 'react'
import { useAttendance } from '../../mock/stores/attendance'

/** Minimal task shape this module needs; the Work module's Task is a superset. */
export interface TaskRef {
  id: string
  key: string
  title: string
}

export interface WorkTask extends TaskRef {
  assignee_id?: string | null
}

type Loaded = {
  tasks: () => WorkTask[]
  subscribe: (fn: () => void) => () => void
} | null

// The Work module may not exist at build time, so it is picked up with a glob instead of a hard import.
declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>
  }
}
const candidates = import.meta.glob('../../mock/stores/work.ts')
let loading: Promise<Loaded> | null = null

function isStore(value: unknown): value is {
  getState: () => { tasks?: unknown }
  subscribe: (fn: () => void) => () => void
} {
  return typeof value === 'function' && 'getState' in value && 'subscribe' in value
}

function load(): Promise<Loaded> {
  if (loading) return loading
  const loader = Object.values(candidates)[0]
  loading = loader
    ? loader()
        .then((mod) => {
          const m = mod as Record<string, unknown>
          // Let the Work module show tracked time from attendance task entries.
          const setProvider = m.setTrackedSecondsProvider
          if (typeof setProvider === 'function') {
            setProvider((taskId: string) =>
              useAttendance
                .getState()
                .taskTimeEntries.filter((e) => e.task_id === taskId)
                .reduce(
                  (sum, e) =>
                    sum +
                    (e.ended_at
                      ? e.seconds
                      : Math.max(0, (Date.now() - new Date(e.started_at).getTime()) / 1000)),
                  0,
                ),
            )
          }
          const store = Object.values(m).find((v) => isStore(v) && Array.isArray(v.getState().tasks))
          if (!isStore(store)) return null
          return {
            tasks: () => store.getState().tasks as WorkTask[],
            subscribe: (fn: () => void) => store.subscribe(fn),
          }
        })
        .catch(() => null)
    : Promise.resolve(null)
  return loading
}

/** All tasks known to the Work module (empty when it is unavailable). */
export function useWorkTasks(): WorkTask[] {
  const [tasks, setTasks] = useState<WorkTask[]>([])
  useEffect(() => {
    let off: (() => void) | undefined
    let alive = true
    void load().then((l) => {
      if (!l || !alive) return
      setTasks(l.tasks())
      off = l.subscribe(() => setTasks(l.tasks()))
    })
    return () => {
      alive = false
      off?.()
    }
  }, [])
  return tasks
}

/** Tasks assigned to the employee, as `{ id, key, title }`. */
export function useMyTasks(employeeId: string): TaskRef[] {
  const all = useWorkTasks()
  return all
    .filter((t) => t.assignee_id === employeeId)
    .map((t) => ({ id: t.id, key: t.key, title: t.title }))
}
