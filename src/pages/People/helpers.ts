import type { EmployeeStatus, EmploymentType, Role } from '../../types'

export const typeLabels: Record<EmploymentType, string> = {
  full_time: 'Full time',
  contractor: 'Contractor',
  intern: 'Intern',
}

export const roleLabels: Record<Role, string> = {
  employee: 'Employee',
  team_lead: 'Team lead',
  hr: 'HR',
  management: 'Management',
}

export const statusLabels: Record<EmployeeStatus, string> = {
  active: 'Active',
  probation: 'Probation',
  on_leave: 'On leave',
  resigned: 'Resigned',
  terminated: 'Terminated',
}

export const statusOptions = (Object.keys(statusLabels) as EmployeeStatus[]).map((v) => ({ value: v, label: statusLabels[v] }))
export const typeOptions = (Object.keys(typeLabels) as EmploymentType[]).map((v) => ({ value: v, label: typeLabels[v] }))
export const roleOptions = (Object.keys(roleLabels) as Role[]).map((v) => ({ value: v, label: roleLabels[v] }))

export function maskAccount(no: string): string {
  return no.length > 4 ? `${'*'.repeat(no.length - 4)}${no.slice(-4)}` : no
}
