import type {
  BankAccount,
  Department,
  Employee,
  EmployeeAsset,
  EmployeeDocument,
  EmploymentType,
  EmployeeStatus,
  OnboardingChecklist,
  Role,
  SalaryStructure,
  Team,
  TeamMember,
  User,
} from '../../types'

export const departments: Department[] = [
  { id: 'dept-eng', name: 'Engineering' },
  { id: 'dept-design', name: 'Design' },
  { id: 'dept-qa', name: 'QA' },
  { id: 'dept-ops', name: 'Operations' },
]

type Seed = {
  n: number
  name: string
  designation: string
  dept: string
  team: string | null
  role: Role
  type: EmploymentType
  status?: EmployeeStatus
  joined: string
  gross: number // monthly BDT; for contractors the hourly rate
}

const seed: Seed[] = [
  { n: 101, name: 'Rafiq Ahmed', designation: 'Managing director', dept: 'dept-ops', team: null, role: 'management', type: 'full_time', joined: '2018-03-01', gross: 260000 },
  { n: 102, name: 'Nasrin Akter', designation: 'HR manager', dept: 'dept-ops', team: null, role: 'hr', type: 'full_time', joined: '2019-06-16', gross: 120000 },
  { n: 103, name: 'Tanvir Hossain', designation: 'Engineering lead', dept: 'dept-eng', team: 'team-web', role: 'team_lead', type: 'full_time', joined: '2019-01-07', gross: 210000 },
  { n: 104, name: 'Farhana Yasmin', designation: 'Design lead', dept: 'dept-design', team: 'team-design', role: 'team_lead', type: 'full_time', joined: '2019-09-01', gross: 165000 },
  { n: 105, name: 'Tariqul Islam', designation: 'QA lead', dept: 'dept-qa', team: 'team-qa', role: 'team_lead', type: 'full_time', joined: '2020-02-10', gross: 145000 },
  { n: 106, name: 'Mahbubur Rahman', designation: 'Operations lead', dept: 'dept-ops', team: 'team-ops', role: 'team_lead', type: 'full_time', joined: '2019-11-03', gross: 135000 },
  { n: 107, name: 'Sadia Sultana', designation: 'Senior software engineer', dept: 'dept-eng', team: 'team-web', role: 'employee', type: 'full_time', joined: '2020-08-17', gross: 150000 },
  { n: 108, name: 'Zahid Hasan', designation: 'Software engineer', dept: 'dept-eng', team: 'team-web', role: 'employee', type: 'full_time', joined: '2021-03-01', gross: 105000 },
  { n: 109, name: 'Imran Hossain', designation: 'Software engineer', dept: 'dept-eng', team: 'team-web', role: 'employee', type: 'full_time', joined: '2021-07-12', gross: 98000 },
  { n: 110, name: 'Rumana Haque', designation: 'Frontend engineer', dept: 'dept-eng', team: 'team-web', role: 'employee', type: 'full_time', joined: '2022-01-09', gross: 95000 },
  { n: 111, name: 'Shafiqul Alam', designation: 'Backend engineer', dept: 'dept-eng', team: 'team-web', role: 'employee', type: 'full_time', joined: '2022-05-23', gross: 92000 },
  { n: 112, name: 'Anika Tabassum', designation: 'Software engineer', dept: 'dept-eng', team: 'team-web', role: 'employee', type: 'full_time', joined: '2023-02-06', gross: 85000 },
  { n: 113, name: 'Fahim Reza', designation: 'Engineering intern', dept: 'dept-eng', team: 'team-web', role: 'employee', type: 'intern', joined: '2026-07-01', gross: 20000 },
  { n: 114, name: 'Nusrat Jahan', designation: 'Contract frontend developer', dept: 'dept-eng', team: 'team-web', role: 'employee', type: 'contractor', joined: '2024-04-15', gross: 1200 },
  { n: 115, name: 'Mehedi Hasan', designation: 'Product designer', dept: 'dept-design', team: 'team-design', role: 'employee', type: 'full_time', joined: '2021-10-04', gross: 100000 },
  { n: 116, name: 'Tasnim Rahman', designation: 'UI designer', dept: 'dept-design', team: 'team-design', role: 'employee', type: 'full_time', joined: '2022-09-19', gross: 88000 },
  { n: 117, name: 'Priya Das', designation: 'Junior designer', dept: 'dept-design', team: 'team-design', role: 'employee', type: 'full_time', status: 'probation', joined: '2026-09-01', gross: 60000 },
  { n: 118, name: 'Arif Chowdhury', designation: 'Contract illustrator', dept: 'dept-design', team: 'team-design', role: 'employee', type: 'contractor', joined: '2025-01-20', gross: 1000 },
  { n: 119, name: 'Sumaiya Akter', designation: 'QA engineer', dept: 'dept-qa', team: 'team-qa', role: 'employee', type: 'full_time', joined: '2021-12-06', gross: 82000 },
  { n: 120, name: 'Kamrul Islam', designation: 'QA engineer', dept: 'dept-qa', team: 'team-qa', role: 'employee', type: 'full_time', joined: '2022-11-14', gross: 78000 },
  { n: 121, name: 'Lamia Khan', designation: 'Test automation engineer', dept: 'dept-qa', team: 'team-qa', role: 'employee', type: 'full_time', joined: '2023-06-05', gross: 88000 },
  { n: 122, name: 'Jahangir Alam', designation: 'Office administrator', dept: 'dept-ops', team: 'team-ops', role: 'employee', type: 'full_time', joined: '2020-10-11', gross: 62000 },
  { n: 123, name: 'Shirin Sultana', designation: 'Accounts executive', dept: 'dept-ops', team: 'team-ops', role: 'employee', type: 'full_time', joined: '2021-04-26', gross: 74000 },
  { n: 124, name: 'Habib Ullah', designation: 'Contract IT support', dept: 'dept-ops', team: 'team-ops', role: 'employee', type: 'contractor', joined: '2025-08-03', gross: 700 },
]

const leadOf: Record<string, string> = {
  'team-web': 'emp-103',
  'team-design': 'emp-104',
  'team-qa': 'emp-105',
  'team-ops': 'emp-106',
}

export const teams: Team[] = [
  { id: 'team-web', name: 'Web platform', department_id: 'dept-eng', lead_employee_id: leadOf['team-web'] },
  { id: 'team-design', name: 'Product design', department_id: 'dept-design', lead_employee_id: leadOf['team-design'] },
  { id: 'team-qa', name: 'Quality', department_id: 'dept-qa', lead_employee_id: leadOf['team-qa'] },
  { id: 'team-ops', name: 'Office operations', department_id: 'dept-ops', lead_employee_id: leadOf['team-ops'] },
]

const slug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, '.')

export const employees: Employee[] = seed.map((s) => ({
  id: `emp-${s.n}`,
  code: `VIV-${s.n}`,
  user_id: `usr-${s.n}`,
  name: s.name,
  email: `${slug(s.name)}@vivacom.example`,
  department_id: s.dept,
  team_id: s.team,
  designation: s.designation,
  employment_type: s.type,
  status: s.status ?? 'active',
  joined_on: s.joined,
  probation_until: s.status === 'probation' ? '2026-12-01' : null,
  exited_on: null,
  phone: `+88017${String(10000000 + s.n * 7919).slice(0, 8)}`,
  nid: String(1990000000 + s.n * 104729).padEnd(13, '0').slice(0, 13),
  avatar_path: null,
}))

export const users: User[] = seed.map((s, i) => ({
  id: `usr-${s.n}`,
  name: s.name,
  email: employees[i].email,
  role: s.role,
  employee_id: `emp-${s.n}`,
  last_seen_at: null,
}))

export const teamMembers: TeamMember[] = seed
  .filter((s) => s.team)
  .map((s) => ({ team_id: s.team as string, employee_id: `emp-${s.n}` }))

function structure(id: string, employeeId: string, from: string, gross: number, type: EmploymentType): SalaryStructure {
  if (type === 'contractor') {
    return {
      id, employee_id: employeeId, effective_from: from,
      basic: 0, house_rent: 0, medical: 0, conveyance: 0, pf_percent: 0, tax_monthly: 0, gross: 0,
      hourly_rate: gross,
    }
  }
  const basic = Math.round(gross * 0.55)
  const house_rent = Math.round(gross * 0.25)
  const medical = Math.round(gross * 0.1)
  const conveyance = gross - basic - house_rent - medical
  return {
    id, employee_id: employeeId, effective_from: from,
    basic, house_rent, medical, conveyance,
    pf_percent: type === 'full_time' ? 5 : 0,
    tax_monthly: gross > 150000 ? Math.round(gross * 0.08) : gross > 90000 ? Math.round(gross * 0.04) : 0,
    gross,
    hourly_rate: Math.round(gross / 22 / 8),
  }
}

// Append-only: everyone has the structure from joining; people hired before 2024 got a revision on 2025-07-01.
export const salaryStructures: SalaryStructure[] = seed.flatMap((s) => {
  const eid = `emp-${s.n}`
  const base = structure(`sal-${s.n}-1`, eid, s.joined, s.type === 'full_time' && s.joined < '2024-01-01' ? Math.round((s.gross / 1.1) / 500) * 500 : s.gross, s.type)
  if (s.type === 'full_time' && s.joined < '2024-01-01') {
    return [base, structure(`sal-${s.n}-2`, eid, '2025-07-01', s.gross, s.type)]
  }
  return [base]
})

const banks = [
  ['Dutch-Bangla Bank', 'Gulshan', '090261725'],
  ['BRAC Bank', 'Banani', '060261579'],
  ['City Bank', 'Motijheel', '225261741'],
  ['Eastern Bank', 'Dhanmondi', '095261379'],
] as const

export const bankAccounts: BankAccount[] = seed.map((s, i) => {
  const [bank, branch, routing] = banks[i % banks.length]
  return {
    id: `bank-${s.n}`,
    employee_id: `emp-${s.n}`,
    bank,
    account_name: s.name,
    account_no: String(1010000000 + s.n * 48611).slice(0, 10),
    routing_no: routing,
    branch,
    is_primary: true,
  }
})

export const employeeDocuments: EmployeeDocument[] = []
export const employeeAssets: EmployeeAsset[] = []
export const onboardingChecklists: OnboardingChecklist[] = []

export function employeeById(id: string): Employee | undefined {
  return employees.find((e) => e.id === id)
}

export function userByEmployeeId(employeeId: string): User | undefined {
  return users.find((u) => u.employee_id === employeeId)
}

export function teamMembersOf(leadEmployeeId: string): Employee[] {
  const ids = teams.filter((t) => t.lead_employee_id === leadEmployeeId).map((t) => t.id)
  return employees.filter((e) => e.team_id && ids.includes(e.team_id))
}
