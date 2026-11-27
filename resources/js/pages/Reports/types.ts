export interface SummaryMonth {
  year: number
  month: number
  label: string
  headcount: number
  gross: number
  overtime: number
  bonus: number
  lop: number
  late: number
  tax: number
  pf_employee: number
  pf_employer: number
  other_deductions: number
  net: number
  employer_cost: number
}

export type Money = Omit<SummaryMonth, 'year' | 'month' | 'label' | 'headcount'>

export interface DepartmentRow extends Money {
  department_id: string | null
  department: string
  headcount: number
}

export interface DepartmentReport {
  rows: DepartmentRow[]
  total: Money & { headcount: number }
}

export interface StatementMonth extends Money {
  year: number
  month: number
  label: string
  paid: boolean
  pf_cumulative_employee: number | null
  pf_cumulative_employer: number | null
}

export interface Statement {
  employee: { id: string; name: string; code: string; designation: string | null }
  tax_year: number
  label: string
  months: StatementMonth[]
  totals: Money
  pf_balance: { employee: number; employer: number } | null
}

export interface SheetRow {
  employee: { id: string; name: string; code: string; department: string | null; team: string | null }
  cells: string[]
  totals: { present: number; half: number; absent: number; leave: number; late: number }
}

export interface Sheet {
  year: number
  month: number
  label: string
  days: { date: string; day: number; dow: string; type: 'work' | 'weekend' | 'holiday' }[]
  rows: SheetRow[]
}

export type TabKey =
  | 'summary'
  | 'department'
  | 'statement'
  | 'sheet'
  | 'att_summary'
  | 'att_daily'
  | 'late_early'
  | 'leave_register'
  | 'leave_balance'
  | 'headcount'
  | 'salary_history'
  | 'tds'

export type ColType = 'text' | 'int' | 'dec' | 'hours' | 'money' | 'date' | 'datetime' | 'pct'
export interface Col {
  key: string
  label: string
  type: ColType
}
export type Row = Record<string, string | number | null>
export interface SubTable {
  title: string
  columns: Col[]
  rows: Row[]
}
export interface TableReport {
  columns: Col[]
  rows: Row[]
  totals: Row | null
  secondary: SubTable | null
  extra: { label?: string; note?: string; in_now?: { name: string; since: string | null; status: string }[] | null } | null
}
export interface TableMeta {
  total: number
  page: number
  per: number
  range: [string, string]
}

export interface Filters {
  tab: TabKey
  year: number
  month: number
  tax_year: number | null
  employee: string | null
  department: string
  team: string
  q: string
  from: string | null
  to: string | null
  date: string
  asof: string
  page: number
}

export interface ReportsProps {
  scope: 'all' | 'team' | 'me'
  filters: Filters
  summary: SummaryMonth[] | null
  department: DepartmentReport | null
  statement: Statement | null
  sheet: Sheet | null
  employees: { id: string; name: string; code: string }[]
  departments: { id: string; name: string }[]
  teams: { id: string; name: string }[]
  tax_years: number[]
  report: TableReport | null
  meta: TableMeta | null
  can_payroll: boolean
}
