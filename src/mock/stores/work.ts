import { useMemo } from 'react'
import { create } from 'zustand'
import {
  attachments as seedAttachments,
  boardColumns as seedColumns,
  DEFAULT_COLUMNS,
  labels as seedLabels,
  projectMembers as seedMembers,
  projects as seedProjects,
  subtasks as seedSubtasks,
  taskActivity as seedActivity,
  taskComments as seedComments,
  taskKeyOf,
  taskLabels as seedTaskLabels,
  tasks as seedTasks,
} from '../db/work'
import { employeeById } from '../db/people'
import { useSession } from '../session'
import type {
  Attachment,
  BoardColumn,
  Label,
  Project,
  ProjectMember,
  Subtask,
  Task,
  TaskActivity,
  TaskComment,
  TaskLabel,
  TaskPriority,
} from '../../types'

export type { Task, Project }

let seq = 1000
const nid = (p: string) => `${p}-${++seq}`
const nowIso = () => new Date().toISOString()

export const priorityLabels: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}
export const priorityOrder: TaskPriority[] = ['urgent', 'high', 'medium', 'low']

export interface NewAttachment {
  name: string
  mime: string
  size: number
  path: string
}

export interface TaskPatch {
  title?: string
  body_md?: string
  priority?: TaskPriority
  assignee_id?: string | null
  estimate_minutes?: number | null
  due_on?: string | null
  label_ids?: string[]
}

export interface NewTask {
  project_id: string
  title: string
  body_md?: string
  column_id?: string
  priority?: TaskPriority
  assignee_id?: string | null
  estimate_minutes?: number | null
  due_on?: string | null
  label_ids?: string[]
}

export interface NewProject {
  key: string
  name: string
  client_id: string | null
  lead_employee_id: string
  billing_type: Project['billing_type']
}

interface WorkState {
  projects: Project[]
  members: ProjectMember[]
  columns: BoardColumn[]
  tasks: Task[]
  labels: Label[]
  taskLabels: TaskLabel[]
  subtasks: Subtask[]
  comments: TaskComment[]
  attachments: Attachment[]
  activity: TaskActivity[]

  createProject: (input: NewProject) => Project | null
  updateProject: (id: string, patch: Partial<Pick<Project, 'name' | 'status' | 'lead_employee_id' | 'client_id'>>) => boolean
  addMember: (projectId: string, employeeId: string) => boolean
  removeMember: (projectId: string, employeeId: string) => boolean
  addColumn: (projectId: string, name: string) => boolean
  renameColumn: (columnId: string, name: string) => boolean
  /** Full ordered list of column ids for the project. */
  reorderColumns: (projectId: string, orderedIds: string[]) => boolean
  createTask: (input: NewTask) => Task | null
  updateTask: (taskId: string, patch: TaskPatch) => void
  moveTask: (taskId: string, columnId: string, position?: number) => void
  toggleSubtask: (subtaskId: string) => void
  addSubtask: (taskId: string, title: string) => void
  addComment: (taskId: string, body: string, attachments?: NewAttachment[]) => void
  addAttachment: (taskId: string, file: NewAttachment) => void
  logActivity: (taskId: string, text: string) => void
}

function actorId(): string {
  return useSession.getState().employee?.id ?? 'emp-101'
}
function actorRole() {
  return useSession.getState().role
}
function name(id: string | null | undefined) {
  return id ? (employeeById(id)?.name ?? id) : 'nobody'
}

/** Project lead, HR and management manage columns and members. */
export function canManageProject(project: Project, employeeId: string, role: string | null): boolean {
  return project.lead_employee_id === employeeId || role === 'hr' || role === 'management'
}

function sessionCanManage(projectId: string): boolean {
  const s = useWork.getState()
  const p = s.projects.find((x) => x.id === projectId)
  return !!p && canManageProject(p, actorId(), actorRole())
}

function sessionIsMember(projectId: string): boolean {
  const s = useWork.getState()
  return sessionCanManage(projectId) || s.members.some((m) => m.project_id === projectId && m.employee_id === actorId())
}

function renumber(tasks: Task[], columnId: string, ids: string[]): Task[] {
  return tasks.map((t) => (t.column_id === columnId ? { ...t, position: ids.indexOf(t.id) } : t))
}

export const useWork = create<WorkState>((set, get) => {
  const log = (taskId: string, text: string) =>
    set((s) => ({ activity: [...s.activity, { id: nid('act'), task_id: taskId, actor_id: actorId(), text, at: nowIso() }] }))

  return {
    projects: seedProjects.map((p) => ({ ...p })),
    members: seedMembers.map((m) => ({ ...m })),
    columns: seedColumns.map((c) => ({ ...c })),
    tasks: seedTasks.map((t) => ({ ...t })),
    labels: seedLabels.map((l) => ({ ...l })),
    taskLabels: seedTaskLabels.map((l) => ({ ...l })),
    subtasks: seedSubtasks.map((x) => ({ ...x })),
    comments: seedComments.map((c) => ({ ...c })),
    attachments: seedAttachments.map((a) => ({ ...a })),
    activity: seedActivity.map((a) => ({ ...a })),

    createProject: (input) => {
      const role = actorRole()
      if (role !== 'hr' && role !== 'management' && role !== 'team_lead') return null
      const key = input.key.trim().toUpperCase()
      if (!/^[A-Z]{2,6}$/.test(key) || get().projects.some((p) => p.key === key) || !input.name.trim()) return null
      const project: Project = {
        id: nid('prj'),
        key,
        name: input.name.trim(),
        client_id: input.billing_type === 'internal' ? null : input.client_id,
        lead_employee_id: input.lead_employee_id,
        status: 'active',
        billing_type: input.billing_type,
        rate: null,
      }
      const cols: BoardColumn[] = DEFAULT_COLUMNS.map((c, i) => ({
        id: nid('col'),
        project_id: project.id,
        name: c.name,
        position: i,
        is_done: c.is_done,
      }))
      set((s) => ({
        projects: [...s.projects, project],
        columns: [...s.columns, ...cols],
        members: [...s.members, { project_id: project.id, employee_id: project.lead_employee_id }],
      }))
      return project
    },

    updateProject: (id, patch) => {
      if (!sessionCanManage(id)) return false
      set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
      return true
    },

    addMember: (projectId, employeeId) => {
      if (!sessionCanManage(projectId)) return false
      if (get().members.some((m) => m.project_id === projectId && m.employee_id === employeeId)) return false
      set((s) => ({ members: [...s.members, { project_id: projectId, employee_id: employeeId }] }))
      return true
    },

    removeMember: (projectId, employeeId) => {
      if (!sessionCanManage(projectId)) return false
      const project = get().projects.find((p) => p.id === projectId)
      if (!project || project.lead_employee_id === employeeId) return false
      set((s) => ({
        members: s.members.filter((m) => !(m.project_id === projectId && m.employee_id === employeeId)),
        tasks: s.tasks.map((t) =>
          t.project_id === projectId && t.assignee_id === employeeId ? { ...t, assignee_id: null } : t,
        ),
      }))
      return true
    },

    addColumn: (projectId, colName) => {
      if (!sessionCanManage(projectId) || !colName.trim()) return false
      set((s) => {
        const mine = s.columns.filter((c) => c.project_id === projectId)
        const col: BoardColumn = {
          id: nid('col'),
          project_id: projectId,
          name: colName.trim(),
          position: mine.length,
          is_done: false,
        }
        return { columns: [...s.columns, col] }
      })
      return true
    },

    renameColumn: (columnId, colName) => {
      const col = get().columns.find((c) => c.id === columnId)
      if (!col || !sessionCanManage(col.project_id) || !colName.trim()) return false
      set((s) => ({ columns: s.columns.map((c) => (c.id === columnId ? { ...c, name: colName.trim() } : c)) }))
      return true
    },

    reorderColumns: (projectId, orderedIds) => {
      if (!sessionCanManage(projectId)) return false
      set((s) => ({
        columns: s.columns.map((c) =>
          c.project_id === projectId && orderedIds.includes(c.id) ? { ...c, position: orderedIds.indexOf(c.id) } : c,
        ),
      }))
      return true
    },

    createTask: (input) => {
      const s = get()
      const project = s.projects.find((p) => p.id === input.project_id)
      if (!project || !input.title.trim() || !sessionIsMember(project.id)) return null
      const cols = s.columns.filter((c) => c.project_id === project.id).sort((a, b) => a.position - b.position)
      const column = cols.find((c) => c.id === input.column_id) ?? cols[1] ?? cols[0]
      if (!column) return null
      const number = Math.max(0, ...s.tasks.filter((t) => t.project_id === project.id).map((t) => t.number)) + 1
      const task: Task = {
        id: nid('tsk'),
        project_id: project.id,
        number,
        key: taskKeyOf(project.key, number),
        title: input.title.trim(),
        body_md: input.body_md ?? '',
        column_id: column.id,
        priority: input.priority ?? 'medium',
        assignee_id: input.assignee_id ?? null,
        reporter_id: actorId(),
        estimate_minutes: input.estimate_minutes ?? null,
        due_on: input.due_on ?? null,
        position: s.tasks.filter((t) => t.column_id === column.id).length,
        created_at: nowIso(),
      }
      set((st) => ({
        tasks: [...st.tasks, task],
        taskLabels: [...st.taskLabels, ...(input.label_ids ?? []).map((label_id) => ({ task_id: task.id, label_id }))],
      }))
      log(task.id, 'created the task')
      return task
    },

    updateTask: (taskId, patch) => {
      const task = get().tasks.find((t) => t.id === taskId)
      if (!task || !sessionIsMember(task.project_id)) return
      const notes: string[] = []
      if (patch.title !== undefined && patch.title.trim() && patch.title !== task.title) notes.push('changed the title')
      if (patch.body_md !== undefined && patch.body_md !== task.body_md) notes.push('edited the description')
      if (patch.priority && patch.priority !== task.priority)
        notes.push(`changed priority from ${priorityLabels[task.priority]} to ${priorityLabels[patch.priority]}`)
      if (patch.assignee_id !== undefined && patch.assignee_id !== task.assignee_id)
        notes.push(patch.assignee_id ? `assigned the task to ${name(patch.assignee_id)}` : 'unassigned the task')
      if (patch.estimate_minutes !== undefined && patch.estimate_minutes !== task.estimate_minutes)
        notes.push(patch.estimate_minutes === null ? 'cleared the estimate' : `set the estimate to ${patch.estimate_minutes / 60}h`)
      if (patch.due_on !== undefined && patch.due_on !== task.due_on)
        notes.push(patch.due_on ? `set the due date to ${patch.due_on}` : 'cleared the due date')
      const { label_ids, ...fields } = patch
      if (fields.title !== undefined && !fields.title.trim()) delete fields.title
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...fields } : t)),
        taskLabels: label_ids
          ? [...s.taskLabels.filter((l) => l.task_id !== taskId), ...label_ids.map((label_id) => ({ task_id: taskId, label_id }))]
          : s.taskLabels,
      }))
      if (label_ids) notes.push('updated labels')
      notes.forEach((n) => log(taskId, n))
    },

    moveTask: (taskId, columnId, position) => {
      const s = get()
      const task = s.tasks.find((t) => t.id === taskId)
      const target = s.columns.find((c) => c.id === columnId)
      if (!task || !target || target.project_id !== task.project_id || !sessionIsMember(task.project_id)) return
      const from = task.column_id
      const targetIds = s.tasks
        .filter((t) => t.column_id === columnId && t.id !== taskId)
        .sort((a, b) => a.position - b.position)
        .map((t) => t.id)
      const at = position === undefined ? targetIds.length : Math.max(0, Math.min(position, targetIds.length))
      targetIds.splice(at, 0, taskId)
      let next = s.tasks.map((t) => (t.id === taskId ? { ...t, column_id: columnId } : t))
      next = renumber(next, columnId, targetIds)
      if (from !== columnId) {
        const fromIds = next
          .filter((t) => t.column_id === from)
          .sort((a, b) => a.position - b.position)
          .map((t) => t.id)
        next = renumber(next, from, fromIds)
      }
      set({ tasks: next })
      if (from !== columnId) {
        const fromName = s.columns.find((c) => c.id === from)?.name ?? ''
        log(taskId, `moved the task from ${fromName} to ${target.name}`)
      }
    },

    toggleSubtask: (subtaskId) => {
      const sub = get().subtasks.find((x) => x.id === subtaskId)
      if (!sub) return
      set((s) => ({ subtasks: s.subtasks.map((x) => (x.id === subtaskId ? { ...x, done: !x.done } : x)) }))
      log(sub.task_id, `${sub.done ? 'reopened' : 'completed'} subtask "${sub.title}"`)
    },

    addSubtask: (taskId, title) => {
      if (!title.trim()) return
      const count = get().subtasks.filter((x) => x.task_id === taskId).length
      set((s) => ({
        subtasks: [...s.subtasks, { id: nid('sub'), task_id: taskId, title: title.trim(), done: false, position: count }],
      }))
      log(taskId, `added subtask "${title.trim()}"`)
    },

    addComment: (taskId, body, files = []) => {
      if (!body.trim() && files.length === 0) return
      const id = nid('cmt')
      const at = nowIso()
      set((s) => ({
        comments: [...s.comments, { id, task_id: taskId, author_id: actorId(), body: body.trim(), created_at: at }],
        attachments: [
          ...s.attachments,
          ...files.map((f) => ({
            id: nid('att'),
            attachable_type: 'task_comment' as const,
            attachable_id: id,
            ...f,
            created_at: at,
          })),
        ],
      }))
    },

    addAttachment: (taskId, file) => {
      set((s) => ({
        attachments: [
          ...s.attachments,
          { id: nid('att'), attachable_type: 'task' as const, attachable_id: taskId, ...file, created_at: nowIso() },
        ],
      }))
      log(taskId, `attached ${file.name}`)
    },

    logActivity: (taskId, text) => log(taskId, text),
  }
})

// ---------- Selectors ----------

export function keyOf(task: Task): string {
  return task.key
}

export function taskByKey(key: string): Task | undefined {
  return useWork.getState().tasks.find((t) => t.key === key)
}

export function isDoneTask(task: Task, columns: BoardColumn[]): boolean {
  return columns.find((c) => c.id === task.column_id)?.is_done ?? false
}

export function tasksForEmployee(employeeId: string): Task[] {
  return useWork.getState().tasks.filter((t) => t.assignee_id === employeeId)
}

export function projectsForEmployee(employeeId: string): Project[] {
  const s = useWork.getState()
  const ids = new Set(s.members.filter((m) => m.employee_id === employeeId).map((m) => m.project_id))
  return s.projects.filter((p) => ids.has(p.id) || p.lead_employee_id === employeeId)
}

/** Open tasks (not in a done column) assigned to the person, for the Attendance task selector. */
export function myOpenTasks(employeeId: string): { id: string; key: string; title: string }[] {
  const s = useWork.getState()
  return s.tasks
    .filter((t) => t.assignee_id === employeeId && !isDoneTask(t, s.columns))
    .map((t) => ({ id: t.id, key: t.key, title: t.title }))
}

let trackedProvider: (taskId: string) => number = () => 0
/** Attendance registers a getter returning total tracked seconds for a task. */
export function setTrackedSecondsProvider(fn: (taskId: string) => number) {
  trackedProvider = fn
}
export function trackedSecondsFor(taskId: string): number {
  return trackedProvider(taskId)
}

/** Open tasks assigned to the signed-in person, most urgent first. */
export function useMyTasks(): Task[] {
  const employeeId = useSession((s) => s.employee?.id)
  const tasks = useWork((s) => s.tasks)
  const columns = useWork((s) => s.columns)
  return useMemo(
    () => tasks.filter((t) => t.assignee_id === employeeId && !isDoneTask(t, columns)),
    [tasks, columns, employeeId],
  )
}
