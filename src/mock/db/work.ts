import { addDays, format, subHours, subMinutes } from 'date-fns'
import { employeeById } from './people'
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

/** Client names for projects. Billing owns the real client records; ids here match `Project.client_id`. */
export const workClients: Record<string, string> = {
  'client-northwind': 'Northwind Logistics',
  'client-apex': 'Apex Retail Group',
  'client-harbor': 'Harbor Health',
}

export const DEFAULT_COLUMNS: { name: string; is_done: boolean }[] = [
  { name: 'Backlog', is_done: false },
  { name: 'To do', is_done: false },
  { name: 'In progress', is_done: false },
  { name: 'Review', is_done: false },
  { name: 'Done', is_done: true },
]

export function taskKeyOf(projectKey: string, number: number): string {
  return `${projectKey}-${number}`
}

export const projects: Project[] = [
  { id: 'prj-pulse', key: 'PULSE', name: 'Pulse mobile app', client_id: 'client-northwind', lead_employee_id: 'emp-103', status: 'active', billing_type: 'retainer', rate: null },
  { id: 'prj-erp', key: 'ERP', name: 'Warehouse ERP', client_id: 'client-harbor', lead_employee_id: 'emp-103', status: 'active', billing_type: 'hourly', rate: 35 },
  { id: 'prj-apex', key: 'APEX', name: 'Apex storefront redesign', client_id: 'client-apex', lead_employee_id: 'emp-104', status: 'active', billing_type: 'fixed', rate: null },
  { id: 'prj-site', key: 'SITE', name: 'Company website', client_id: null, lead_employee_id: 'emp-104', status: 'active', billing_type: 'internal', rate: null },
  { id: 'prj-ops', key: 'OPS', name: 'Internal tooling', client_id: null, lead_employee_id: 'emp-106', status: 'paused', billing_type: 'internal', rate: null },
]

const memberIds: Record<string, string[]> = {
  PULSE: ['emp-103', 'emp-107', 'emp-108', 'emp-110', 'emp-114', 'emp-115', 'emp-119'],
  ERP: ['emp-103', 'emp-107', 'emp-109', 'emp-111', 'emp-112', 'emp-120', 'emp-121'],
  APEX: ['emp-104', 'emp-110', 'emp-115', 'emp-116', 'emp-117', 'emp-118', 'emp-119'],
  SITE: ['emp-104', 'emp-116', 'emp-117', 'emp-110', 'emp-113'],
  OPS: ['emp-106', 'emp-122', 'emp-123', 'emp-124', 'emp-112'],
}

export const projectMembers: ProjectMember[] = projects.flatMap((p) =>
  memberIds[p.key].map((employee_id) => ({ project_id: p.id, employee_id })),
)

export const boardColumns: BoardColumn[] = projects.flatMap((p) =>
  DEFAULT_COLUMNS.map((c, i) => ({
    id: `col-${p.key}-${i}`,
    project_id: p.id,
    name: c.name,
    position: i,
    is_done: c.is_done,
  })),
)

export const labels: Label[] = [
  { id: 'lbl-bug', project_id: null, name: 'bug', color: 'danger' },
  { id: 'lbl-feature', project_id: null, name: 'feature', color: 'info' },
  { id: 'lbl-design', project_id: null, name: 'design', color: 'accent' },
  { id: 'lbl-qa', project_id: null, name: 'qa', color: 'warning' },
  { id: 'lbl-tech-debt', project_id: null, name: 'tech debt', color: 'neutral' },
  { id: 'lbl-blocked', project_id: null, name: 'blocked', color: 'danger' },
  { id: 'lbl-docs', project_id: null, name: 'docs', color: 'neutral' },
]
const labelByName = Object.fromEntries(labels.map((l) => [l.name, l.id]))

type Row = [
  title: string,
  col: number,
  priority: TaskPriority,
  assignee: string | null,
  estimateHours: number | null,
  dueInDays: number | null,
  labels: string[],
  subtasks?: string[],
]

const rows: Record<string, Row[]> = {
  PULSE: [
    ['Fix crash when opening notifications on Android 13', 3, 'urgent', 'emp-108', 4, -2, ['bug'], ['Reproduce on Pixel 6', 'Guard null payload', 'Add regression test']],
    ['Biometric login for returning users', 2, 'high', 'emp-107', 12, 5, ['feature'], ['Keychain storage', 'Fallback to PIN', 'Settings toggle']],
    ['Offline cache for shipment list', 2, 'medium', 'emp-110', 10, 9, ['feature']],
    ['Design empty states for tracking screen', 1, 'medium', 'emp-115', 6, 4, ['design']],
    ['Upgrade React Native to 0.76', 0, 'low', null, 16, null, ['tech debt']],
    ['Push notification deep links', 3, 'high', 'emp-114', 8, 1, ['feature'], ['Parse link scheme', 'Cold start handling']],
    ['Regression pass for release 2.4', 2, 'high', 'emp-119', 10, 3, ['qa']],
    ['Map pin clustering is slow with 500 markers', 4, 'medium', 'emp-110', 6, -6, ['bug']],
    ['Add dark theme to settings screen', 4, 'low', 'emp-114', 3, -10, ['design']],
    ['Analytics events for onboarding funnel', 1, 'medium', 'emp-108', 5, 12, ['feature']],
    ['Write API error handling guide', 0, 'low', 'emp-107', 4, null, ['docs']],
    ['Session token refresh fails after airplane mode', 2, 'urgent', 'emp-107', 5, 0, ['bug', 'blocked']],
  ],
  ERP: [
    ['Barcode scanner support in goods receipt', 2, 'high', 'emp-111', 14, 6, ['feature'], ['Scanner driver', 'Receipt line matching', 'Error sounds']],
    ['Stock transfer between warehouses', 1, 'high', 'emp-109', 20, 14, ['feature']],
    ['Inventory report times out for 50k SKUs', 3, 'urgent', 'emp-112', 8, -1, ['bug'], ['Add index on sku_id', 'Paginate export']],
    ['Migrate purchase order PDFs to queue worker', 2, 'medium', 'emp-111', 10, 8, ['tech debt']],
    ['Role permissions matrix for store managers', 1, 'medium', 'emp-107', 9, 11, ['feature']],
    ['Test plan for cycle count module', 4, 'medium', 'emp-120', 6, -8, ['qa']],
    ['Automate smoke tests for goods receipt', 3, 'medium', 'emp-121', 12, 2, ['qa']],
    ['Supplier lead time calculation is off by one day', 4, 'high', 'emp-109', 3, -12, ['bug']],
    ['Document stock valuation rules', 0, 'low', null, 5, null, ['docs']],
    ['Replace legacy date picker', 0, 'low', 'emp-112', 4, null, ['tech debt']],
    ['Low stock alerts by email', 1, 'medium', 'emp-109', 7, 20, ['feature']],
    ['Audit log entries missing user on bulk edit', 2, 'high', 'emp-111', 4, 3, ['bug']],
  ],
  APEX: [
    ['Product detail page layout, desktop', 4, 'high', 'emp-116', 10, -14, ['design']],
    ['Product detail page layout, mobile', 3, 'high', 'emp-116', 8, 1, ['design']],
    ['Checkout flow wireframes', 4, 'high', 'emp-115', 12, -20, ['design']],
    ['Build product gallery component', 2, 'high', 'emp-110', 10, 5, ['feature'], ['Thumbnail strip', 'Zoom on hover', 'Keyboard navigation']],
    ['Icon set for category navigation', 2, 'medium', 'emp-118', 8, 7, ['design']],
    ['Cart drawer interaction spec', 1, 'medium', 'emp-117', 5, 10, ['design']],
    ['Cross-browser pass on checkout', 1, 'medium', 'emp-119', 8, 15, ['qa']],
    ['Typography scale review with client', 3, 'low', 'emp-115', 3, 2, ['design']],
    ['Image optimisation pipeline', 0, 'medium', 'emp-110', 9, null, ['tech debt']],
    ['Accessibility audit of filters', 0, 'high', 'emp-119', 6, null, ['qa']],
    ['Search results empty state copy', 2, 'low', 'emp-117', 2, -3, ['design']],
  ],
  SITE: [
    ['Rewrite careers page with open roles', 2, 'medium', 'emp-117', 5, 4, ['design']],
    ['Case study template', 1, 'medium', 'emp-116', 8, 12, ['design']],
    ['Lighthouse score below 80 on home', 3, 'high', 'emp-110', 6, 1, ['bug']],
    ['Add sitemap and robots', 4, 'low', 'emp-113', 2, -7, ['tech debt']],
    ['Contact form spam protection', 0, 'medium', 'emp-113', 3, null, ['feature']],
    ['Update team photos', 1, 'low', 'emp-117', 3, 18, ['design']],
    ['Blog layout for long posts', 4, 'medium', 'emp-116', 6, -16, ['design']],
  ],
  OPS: [
    ['Leave balance spreadsheet import', 1, 'medium', 'emp-123', 4, 10, ['feature']],
    ['Asset tag label printing', 2, 'low', 'emp-122', 3, 6, ['feature']],
    ['VPN access request form', 0, 'low', 'emp-124', 2, null, ['feature']],
    ['Office supply reorder reminders', 4, 'low', 'emp-122', 2, -9, ['feature']],
    ['Backup restore drill notes', 3, 'medium', 'emp-112', 4, -1, ['docs']],
    ['Monthly expense export fails on commas', 2, 'high', 'emp-123', 3, 0, ['bug']],
  ],
}

const bodies = [
  'Steps to reproduce are in the linked thread.\n\n- Expected: works as specced\n- Actual: see description\n\nUse `feature_flags.new_flow` while testing.',
  'Scope for this task:\n\n- Implement the change behind a flag\n- Update the **acceptance checks**\n- Notify QA when ready for review',
  'Follow-up from the planning call. Keep the change small and avoid touching shared modules.',
]

const reporters: Record<string, string> = { PULSE: 'emp-103', ERP: 'emp-103', APEX: 'emp-104', SITE: 'emp-104', OPS: 'emp-106' }

const now = new Date()
const iso = (d: Date) => d.toISOString()
const day = (offset: number) => format(addDays(now, offset), 'yyyy-MM-dd')

export const tasks: Task[] = []
export const taskLabels: TaskLabel[] = []
export const subtasks: Subtask[] = []
export const taskComments: TaskComment[] = []
export const attachments: Attachment[] = []
export const taskActivity: TaskActivity[] = []

const positions: Record<string, number> = {}
let uid = 0

projects.forEach((p) => {
  rows[p.key].forEach((r, i) => {
    const [title, col, priority, assignee, hours, due, lbls, subs] = r
    const number = i + 1
    const column = boardColumns.find((c) => c.id === `col-${p.key}-${col}`)!
    const posKey = column.id
    positions[posKey] = (positions[posKey] ?? -1) + 1
    const id = `tsk-${p.key.toLowerCase()}-${number}`
    const created = subHours(now, 24 * (rows[p.key].length - i) + 3)
    const reporter = reporters[p.key]
    tasks.push({
      id,
      project_id: p.id,
      number,
      key: taskKeyOf(p.key, number),
      title,
      body_md: bodies[i % bodies.length],
      column_id: column.id,
      priority,
      assignee_id: assignee,
      reporter_id: reporter,
      estimate_minutes: hours === null ? null : hours * 60,
      due_on: due === null ? null : day(due),
      position: positions[posKey],
      created_at: iso(created),
    })
    lbls.forEach((l) => taskLabels.push({ task_id: id, label_id: labelByName[l] }))
    ;(subs ?? []).forEach((s, si) =>
      subtasks.push({ id: `sub-${++uid}`, task_id: id, title: s, done: column.is_done || si === 0, position: si }),
    )
    taskActivity.push({ id: `act-${++uid}`, task_id: id, actor_id: reporter, text: 'created the task', at: iso(created) })
    if (assignee) {
      taskActivity.push({
        id: `act-${++uid}`,
        task_id: id,
        actor_id: reporter,
        text: `assigned the task to ${employeeById(assignee)?.name ?? assignee}`,
        at: iso(subMinutes(created, -5)),
      })
    }
    if (col > 1) {
      taskActivity.push({
        id: `act-${++uid}`,
        task_id: id,
        actor_id: assignee ?? reporter,
        text: `moved the task to ${boardColumns.find((c) => c.id === column.id)!.name}`,
        at: iso(subHours(now, 6 + i)),
      })
    }
  })
})

const comment = (key: string, author: string, body: string, hoursAgo: number) => {
  const t = tasks.find((x) => x.key === key)!
  taskComments.push({ id: `cmt-${++uid}`, task_id: t.id, author_id: author, body, created_at: iso(subHours(now, hoursAgo)) })
}
comment('PULSE-1', 'emp-103', 'This looks related to PULSE-12, same token path. Check both together.', 30)
comment('PULSE-1', 'emp-108', 'Reproduced on the emulator. Payload is null when the app is cold started from a tray tap.', 20)
comment('PULSE-12', 'emp-107', 'Blocked until the staging auth service is fixed. See ERP-12 for the shared logging change.', 9)
comment('PULSE-6', 'emp-114', 'Link parsing is done, waiting on PULSE-2 for the auth gate.', 14)
comment('ERP-3', 'emp-112', 'Added the index, export is down from 40s to 6s. Still need pagination.', 8)
comment('ERP-3', 'emp-103', 'Good. Please also check ERP-8 since it uses the same query.', 5)
comment('APEX-2', 'emp-116', 'Spacing matches the desktop version from APEX-1. Sharing in the review column.', 12)
comment('APEX-4', 'emp-110', 'Using the new tokens from SITE-7 for the gallery arrows.', 26)
comment('SITE-3', 'emp-110', 'Largest contributor is the hero video. Switching to a poster image first.', 4)
comment('OPS-6', 'emp-123', 'Commas inside descriptions break the CSV. Need to quote fields.', 2)

const svg = (label: string, fill: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200"><rect width="320" height="200" fill="${fill}"/><text x="160" y="106" text-anchor="middle" font-family="sans-serif" font-size="16" fill="rgb(92,99,112)">${label}</text></svg>`,
  )}`
const attach = (key: string, name: string, fill: string) => {
  const t = tasks.find((x) => x.key === key)!
  attachments.push({
    id: `att-${++uid}`,
    attachable_type: 'task',
    attachable_id: t.id,
    name,
    mime: 'image/svg+xml',
    size: 1200,
    path: svg(name, fill),
    created_at: iso(subHours(now, 28)),
  })
}
attach('PULSE-1', 'crash-log.svg', 'rgb(242,243,245)')
attach('ERP-3', 'slow-query.svg', 'rgb(228,229,233)')
attach('APEX-2', 'mobile-layout.svg', 'rgb(247,247,248)')
