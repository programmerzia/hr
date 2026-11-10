import type { Ability, Role } from '../types'

export type { Role, Ability }

const table: Record<Ability, Role[]> = {
  view_team: ['team_lead', 'hr', 'management'],
  approve_leave_lead: ['team_lead', 'management'],
  approve_leave_hr: ['hr', 'management'],
  manage_people: ['hr', 'management'],
  manage_payroll: ['hr', 'management'],
  approve_payroll: ['management'],
  manage_billing: ['management'],
  verify_claims: ['team_lead', 'management'],
  approve_claims: ['management'],
  manage_projects: ['team_lead', 'management'],
  manage_settings: ['hr', 'management'],
}

/** Role-level check. Scope (e.g. "only own team") is enforced in the stores. */
export function can(role: Role, ability: Ability): boolean {
  return table[ability].includes(role)
}
