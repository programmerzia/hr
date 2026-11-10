import type { BadgeVariant } from '../types'

export interface StatusMeta {
  label: string
  variant: BadgeVariant
}

const map: Record<string, StatusMeta> = {
  // attendance
  not_started: { label: 'Not started', variant: 'neutral' },
  working: { label: 'Working', variant: 'success' },
  on_break: { label: 'On break', variant: 'warning' },
  offline: { label: 'Offline', variant: 'neutral' },
  ended: { label: 'Ended', variant: 'neutral' },
  on_leave: { label: 'On leave', variant: 'info' },
  holiday: { label: 'Holiday', variant: 'neutral' },
  absent: { label: 'Absent', variant: 'danger' },
  late: { label: 'Late', variant: 'danger' },
  // generic decisions
  pending: { label: 'Pending', variant: 'info' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
  // leave
  pending_lead: { label: 'Pending lead', variant: 'info' },
  pending_hr: { label: 'Pending HR', variant: 'info' },
  // employee
  active: { label: 'Active', variant: 'success' },
  probation: { label: 'Probation', variant: 'warning' },
  resigned: { label: 'Resigned', variant: 'neutral' },
  terminated: { label: 'Terminated', variant: 'danger' },
  // payroll / claims / invoices
  draft: { label: 'Draft', variant: 'neutral' },
  review: { label: 'In review', variant: 'info' },
  paid: { label: 'Paid', variant: 'success' },
  submitted: { label: 'Submitted', variant: 'info' },
  verified: { label: 'Verified', variant: 'info' },
  sent: { label: 'Sent', variant: 'info' },
  overdue: { label: 'Overdue', variant: 'danger' },
  void: { label: 'Void', variant: 'neutral' },
  // projects
  paused: { label: 'Paused', variant: 'warning' },
  done: { label: 'Done', variant: 'success' },
}

export function statusMeta(status: string): StatusMeta {
  return (
    map[status] ?? {
      label: status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      variant: 'neutral',
    }
  )
}

export const breakCategoryLabels: Record<string, string> = {
  short: 'Short break',
  tea: 'Tea break',
  lunch: 'Lunch',
  official: 'Official step-out',
  idle: 'Idle',
  signed_out: 'Signed out',
  offline: 'Offline',
}

/** Categories the system writes; never offered in a picker. */
export const systemBreakCategories = ['idle', 'offline'] as const

/** Avatar presence ring for a day status: green working, amber on break, gray otherwise. */
export function presenceTone(status: string): 'success' | 'warning' | 'neutral' {
  return status === 'working' ? 'success' : status === 'on_break' ? 'warning' : 'neutral'
}
