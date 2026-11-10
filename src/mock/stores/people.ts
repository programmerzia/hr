import { create } from 'zustand'
import * as seed from '../db/people'
import type {
  BankAccount,
  Department,
  Employee,
  EmployeeAsset,
  EmployeeDocument,
  EmployeeDocumentKind,
  EmployeeStatus,
  EmploymentType,
  Id,
  ISODate,
  OnboardingChecklist,
  Role,
  SalaryStructure,
  Team,
  TeamMember,
  User,
} from '../../types'

export interface EmploymentEvent {
  id: Id
  employee_id: Id
  effective_on: ISODate
  kind: 'joined' | 'designation' | 'status' | 'team'
  text: string
}

export interface SalaryInput {
  effective_from: ISODate
  basic: number
  house_rent: number
  medical: number
  conveyance: number
  pf_percent: number
  tax_monthly: number
  /** Contractors are paid per hour; employees derive it from gross. */
  hourly_rate?: number
}

export interface OnboardPayload {
  name: string
  email: string
  phone: string
  nid: string
  department_id: Id
  team_id: Id | null
  designation: string
  employment_type: EmploymentType
  role: Role
  joined_on: ISODate
  probation_until: ISODate | null
  salary: SalaryInput
  bank: Pick<BankAccount, 'bank' | 'account_name' | 'account_no' | 'routing_no' | 'branch'>
  checklist: string[]
}

export type EmployeePatch = Partial<
  Pick<Employee, 'name' | 'email' | 'phone' | 'nid' | 'department_id' | 'team_id' | 'designation' | 'employment_type' | 'probation_until'>
>

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export const DEFAULT_CHECKLIST = [
  'Laptop issued',
  'Email and chat accounts created',
  'Policy acknowledgement signed',
  'Bank details verified',
  'Employment contract signed',
]

export const todayIso = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function checklistFor(employeeId: string, labels: string[], doneCount = 0): OnboardingChecklist[] {
  return labels.map((label, i) => ({
    id: `chk-${employeeId}-${i + 1}`,
    employee_id: employeeId,
    label,
    done: i < doneCount,
    done_at: i < doneCount ? '2026-09-02T11:00:00+06:00' : null,
  }))
}

const seedHistory: EmploymentEvent[] = [
  ...seed.employees.map((e) => ({
    id: `evt-${e.id}-join`,
    employee_id: e.id,
    effective_on: e.joined_on,
    kind: 'joined' as const,
    text: `Joined as ${e.designation.toLowerCase()}`,
  })),
  { id: 'evt-107-promo', employee_id: 'emp-107', effective_on: '2023-01-01', kind: 'designation', text: 'Promoted to senior software engineer' },
  { id: 'evt-110-promo', employee_id: 'emp-110', effective_on: '2024-07-01', kind: 'designation', text: 'Moved from software engineer to frontend engineer' },
  { id: 'evt-103-promo', employee_id: 'emp-103', effective_on: '2021-01-01', kind: 'designation', text: 'Promoted to engineering lead' },
  { id: 'evt-117-prob', employee_id: 'emp-117', effective_on: '2026-09-01', kind: 'status', text: 'Status set to probation' },
]

const seedDocuments: EmployeeDocument[] = [
  ...seed.employees.slice(0, 24).map((e, i) => ({
    id: `doc-${e.id}-nid`,
    employee_id: e.id,
    kind: 'nid' as EmployeeDocumentKind,
    name: 'National ID copy.pdf',
    path: `/mock/documents/${e.code}-nid.pdf`,
    uploaded_at: `${e.joined_on}T10:${String(10 + (i % 40)).padStart(2, '0')}:00+06:00`,
  })),
  ...seed.employees
    .filter((e) => e.employment_type === 'full_time')
    .map((e) => ({
      id: `doc-${e.id}-contract`,
      employee_id: e.id,
      kind: 'contract' as EmployeeDocumentKind,
      name: 'Employment contract.pdf',
      path: `/mock/documents/${e.code}-contract.pdf`,
      uploaded_at: `${e.joined_on}T12:00:00+06:00`,
    })),
]

const seedAssets: EmployeeAsset[] = seed.employees
  .filter((e) => e.employment_type !== 'contractor')
  .map((e, i) => ({
    id: `ast-${e.id}-1`,
    employee_id: e.id,
    name: i % 3 === 0 ? 'MacBook Pro 14"' : i % 3 === 1 ? 'Dell Latitude 7440' : 'ThinkPad T14',
    tag: `LT-${String(200 + i).padStart(4, '0')}`,
    assigned_on: e.joined_on,
    returned_on: null,
    status: 'assigned' as const,
  }))

interface PeopleState {
  employees: Employee[]
  users: User[]
  departments: Department[]
  teams: Team[]
  teamMembers: TeamMember[]
  salaryStructures: SalaryStructure[]
  bankAccounts: BankAccount[]
  documents: EmployeeDocument[]
  assets: EmployeeAsset[]
  onboardingChecklists: OnboardingChecklist[]
  employmentHistory: EmploymentEvent[]

  onboardEmployee: (payload: OnboardPayload) => Result<Employee>
  updateEmployee: (employeeId: Id, patch: EmployeePatch) => Result<Employee>
  changeStatus: (employeeId: Id, status: EmployeeStatus, effectiveOn: ISODate) => Result<Employee>
  addSalaryStructure: (employeeId: Id, input: SalaryInput) => Result<SalaryStructure>
  updateBankAccount: (
    employeeId: Id,
    patch: Partial<Pick<BankAccount, 'bank' | 'account_name' | 'account_no' | 'routing_no' | 'branch'>>,
  ) => Result<BankAccount>
  toggleChecklistItem: (itemId: Id) => void
  addDocument: (employeeId: Id, doc: { kind: EmployeeDocumentKind; name: string }) => EmployeeDocument
  addAsset: (employeeId: Id, asset: { name: string; tag: string; assigned_on: ISODate }) => EmployeeAsset

  employeeById: (id: Id) => Employee | undefined
  teamOf: (employeeId: Id) => Team | undefined
  leadOf: (employeeId: Id) => Employee | undefined
  membersOfLead: (leadEmployeeId: Id) => Employee[]
  currentSalary: (employeeId: Id, onDate?: ISODate) => SalaryStructure | undefined
  salaryHistory: (employeeId: Id) => SalaryStructure[]
  bankOf: (employeeId: Id) => BankAccount | undefined
}

const fail = <T>(error: string): Result<T> => ({ ok: false, error })

export const usePeopleStore = create<PeopleState>((set, get) => ({
  employees: seed.employees.map((e) => ({ ...e })),
  users: seed.users.map((u) => ({ ...u })),
  departments: seed.departments.map((d) => ({ ...d })),
  teams: seed.teams.map((t) => ({ ...t })),
  teamMembers: seed.teamMembers.map((m) => ({ ...m })),
  salaryStructures: seed.salaryStructures.map((s) => ({ ...s })),
  bankAccounts: seed.bankAccounts.map((b) => ({ ...b })),
  documents: seedDocuments,
  assets: seedAssets,
  onboardingChecklists: [
    ...checklistFor('emp-113', DEFAULT_CHECKLIST, 4),
    ...checklistFor('emp-117', DEFAULT_CHECKLIST, 3),
  ],
  employmentHistory: seedHistory,

  onboardEmployee: (p) => {
    const s = get()
    if (!p.name.trim() || !p.email.trim()) return fail('Name and email are required')
    if (s.employees.some((e) => e.email.toLowerCase() === p.email.trim().toLowerCase())) {
      return fail('Someone with this email already exists')
    }
    const next = Math.max(...s.employees.map((e) => Number(e.id.slice(4)))) + 1
    const id = `emp-${next}`
    const userId = `usr-${next}`
    const employee: Employee = {
      id,
      code: `VIV-${next}`,
      user_id: userId,
      name: p.name.trim(),
      email: p.email.trim(),
      department_id: p.department_id,
      team_id: p.team_id,
      designation: p.designation.trim(),
      employment_type: p.employment_type,
      status: p.probation_until ? 'probation' : 'active',
      joined_on: p.joined_on,
      probation_until: p.probation_until,
      exited_on: null,
      phone: p.phone.trim(),
      nid: p.nid.trim(),
      avatar_path: null,
    }
    const user: User = {
      id: userId,
      name: employee.name,
      email: employee.email,
      password: 'welcome123',
      role: p.role,
      employee_id: id,
      last_seen_at: null,
    }
    const gross = p.salary.basic + p.salary.house_rent + p.salary.medical + p.salary.conveyance
    const salary: SalaryStructure = {
      id: `sal-${next}-1`,
      employee_id: id,
      ...p.salary,
      gross,
      hourly_rate: p.salary.hourly_rate ?? Math.round(gross / 22 / 8),
    }
    const bank: BankAccount = { id: `bank-${next}`, employee_id: id, is_primary: true, ...p.bank }
    const member: TeamMember | null = p.team_id ? { team_id: p.team_id, employee_id: id } : null

    // Keep the shared seed in step so session sign-in and other modules see the new person.
    seed.employees.push({ ...employee })
    seed.users.push({ ...user })
    if (member) seed.teamMembers.push({ ...member })

    set({
      employees: [...s.employees, employee],
      users: [...s.users, user],
      teamMembers: member ? [...s.teamMembers, member] : s.teamMembers,
      salaryStructures: [...s.salaryStructures, salary],
      bankAccounts: [...s.bankAccounts, bank],
      onboardingChecklists: [...s.onboardingChecklists, ...checklistFor(id, p.checklist)],
      employmentHistory: [
        ...s.employmentHistory,
        { id: `evt-${id}-join`, employee_id: id, effective_on: p.joined_on, kind: 'joined', text: `Joined as ${employee.designation.toLowerCase()}` },
      ],
    })
    return { ok: true, value: employee }
  },

  updateEmployee: (employeeId, patch) => {
    const s = get()
    const cur = s.employees.find((e) => e.id === employeeId)
    if (!cur) return fail('Employee not found')
    const updated: Employee = { ...cur, ...patch }
    const events: EmploymentEvent[] = []
    if (patch.designation && patch.designation !== cur.designation) {
      events.push({ id: `evt-${employeeId}-${Date.now()}`, employee_id: employeeId, effective_on: todayIso(), kind: 'designation', text: `Designation changed from ${cur.designation.toLowerCase()} to ${patch.designation.toLowerCase()}` })
    }
    let teamMembers = s.teamMembers
    if (patch.team_id !== undefined && patch.team_id !== cur.team_id) {
      teamMembers = s.teamMembers.filter((m) => m.employee_id !== employeeId)
      if (patch.team_id) teamMembers = [...teamMembers, { team_id: patch.team_id, employee_id: employeeId }]
      const team = s.teams.find((t) => t.id === patch.team_id)
      events.push({ id: `evt-${employeeId}-team-${Date.now()}`, employee_id: employeeId, effective_on: todayIso(), kind: 'team', text: team ? `Moved to ${team.name}` : 'Removed from team' })
    }
    const seedRow = seed.employees.find((e) => e.id === employeeId)
    if (seedRow) Object.assign(seedRow, patch)
    set({
      employees: s.employees.map((e) => (e.id === employeeId ? updated : e)),
      users: patch.name || patch.email ? s.users.map((u) => (u.employee_id === employeeId ? { ...u, name: updated.name, email: updated.email } : u)) : s.users,
      teamMembers,
      employmentHistory: [...s.employmentHistory, ...events],
    })
    return { ok: true, value: updated }
  },

  changeStatus: (employeeId, status, effectiveOn) => {
    const s = get()
    const cur = s.employees.find((e) => e.id === employeeId)
    if (!cur) return fail('Employee not found')
    if (cur.status === status) return fail('Already in this status')
    const exiting = status === 'resigned' || status === 'terminated'
    const updated: Employee = {
      ...cur,
      status,
      exited_on: exiting ? effectiveOn : null,
      probation_until: status === 'probation' ? cur.probation_until : null,
    }
    const seedRow = seed.employees.find((e) => e.id === employeeId)
    if (seedRow) Object.assign(seedRow, { status, exited_on: updated.exited_on })
    set({
      employees: s.employees.map((e) => (e.id === employeeId ? updated : e)),
      employmentHistory: [
        ...s.employmentHistory,
        {
          id: `evt-${employeeId}-st-${Date.now()}`,
          employee_id: employeeId,
          effective_on: effectiveOn,
          kind: 'status',
          text: `Status changed from ${cur.status.replace('_', ' ')} to ${status.replace('_', ' ')}${exiting ? '. Sign-in disabled' : ''}`,
        },
      ],
    })
    return { ok: true, value: updated }
  },

  addSalaryStructure: (employeeId, input) => {
    const s = get()
    const history = s.salaryStructures.filter((x) => x.employee_id === employeeId)
    const latest = history.reduce<string>((m, x) => (x.effective_from > m ? x.effective_from : m), '')
    if (input.effective_from <= latest) return fail('Effective date must be after the current structure')
    const gross = input.basic + input.house_rent + input.medical + input.conveyance
    const row: SalaryStructure = {
      ...input,
      id: `sal-${employeeId.slice(4)}-${history.length + 1}`,
      employee_id: employeeId,
      gross,
      hourly_rate: input.hourly_rate ?? Math.round(gross / 22 / 8),
    }
    set({ salaryStructures: [...s.salaryStructures, row] })
    return { ok: true, value: row }
  },

  updateBankAccount: (employeeId, patch) => {
    const s = get()
    const cur = s.bankAccounts.find((b) => b.employee_id === employeeId && b.is_primary)
    if (!cur) return fail('No bank account on file')
    const updated = { ...cur, ...patch }
    set({ bankAccounts: s.bankAccounts.map((b) => (b.id === cur.id ? updated : b)) })
    return { ok: true, value: updated }
  },

  toggleChecklistItem: (itemId) =>
    set((s) => ({
      onboardingChecklists: s.onboardingChecklists.map((c) =>
        c.id === itemId ? { ...c, done: !c.done, done_at: c.done ? null : new Date().toISOString() } : c,
      ),
    })),

  addDocument: (employeeId, doc) => {
    const row: EmployeeDocument = {
      id: `doc-${employeeId}-${Date.now()}`,
      employee_id: employeeId,
      kind: doc.kind,
      name: doc.name,
      path: `/mock/documents/${doc.name}`,
      uploaded_at: new Date().toISOString(),
    }
    set((s) => ({ documents: [...s.documents, row] }))
    return row
  },

  addAsset: (employeeId, asset) => {
    const row: EmployeeAsset = {
      id: `ast-${employeeId}-${Date.now()}`,
      employee_id: employeeId,
      ...asset,
      returned_on: null,
      status: 'assigned',
    }
    set((s) => ({ assets: [...s.assets, row] }))
    return row
  },

  employeeById: (id) => get().employees.find((e) => e.id === id),
  teamOf: (employeeId) => {
    const e = get().employees.find((x) => x.id === employeeId)
    return e?.team_id ? get().teams.find((t) => t.id === e.team_id) : undefined
  },
  leadOf: (employeeId) => {
    const team = get().teamOf(employeeId)
    if (!team || team.lead_employee_id === employeeId) return undefined
    return get().employees.find((e) => e.id === team.lead_employee_id)
  },
  membersOfLead: (leadEmployeeId) => {
    const s = get()
    const ids = s.teams.filter((t) => t.lead_employee_id === leadEmployeeId).map((t) => t.id)
    return s.employees.filter((e) => e.team_id && ids.includes(e.team_id) && e.id !== leadEmployeeId)
  },
  salaryHistory: (employeeId) =>
    get()
      .salaryStructures.filter((x) => x.employee_id === employeeId)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from)),
  currentSalary: (employeeId, onDate = todayIso()) => {
    const hist = get().salaryHistory(employeeId)
    return hist.find((x) => x.effective_from <= onDate) ?? hist[hist.length - 1]
  },
  bankOf: (employeeId) => get().bankAccounts.find((b) => b.employee_id === employeeId && b.is_primary),
}))
