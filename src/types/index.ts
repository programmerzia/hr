// Domain types mirroring docs/02-architecture.md "Data model".
// snake_case fields match Laravel JSON. Dates are ISO strings, ids are strings.

export type Id = string
export type ISODate = string // 2026-11-12
export type ISODateTime = string // 2026-11-12T09:12:00+06:00

// ---------- Identity / org ----------
export type Role = 'employee' | 'team_lead' | 'hr' | 'management'
export type EmploymentType = 'full_time' | 'contractor' | 'intern'
export type EmployeeStatus = 'active' | 'probation' | 'on_leave' | 'resigned' | 'terminated'

export interface User {
  id: Id
  name: string
  email: string
  password?: string
  role: Role
  employee_id: Id
  last_seen_at: ISODateTime | null
}

export interface Employee {
  id: Id
  code: string // VIV-101
  user_id: Id
  name: string
  email: string
  department_id: Id
  team_id: Id | null
  designation: string
  employment_type: EmploymentType
  status: EmployeeStatus
  joined_on: ISODate
  probation_until: ISODate | null
  exited_on: ISODate | null
  phone: string
  nid: string
  avatar_path: string | null
}

export interface Department {
  id: Id
  name: string
}

export interface Team {
  id: Id
  name: string
  department_id: Id
  lead_employee_id: Id
}

export interface TeamMember {
  team_id: Id
  employee_id: Id
}

export interface SalaryStructure {
  id: Id
  employee_id: Id
  effective_from: ISODate
  basic: number
  house_rent: number
  medical: number
  conveyance: number
  pf_percent: number
  tax_monthly: number
  gross: number
  hourly_rate: number
}

export interface BankAccount {
  id: Id
  employee_id: Id
  bank: string
  account_name: string
  account_no: string
  routing_no: string
  branch: string
  is_primary: boolean
}

export type EmployeeDocumentKind = 'nid' | 'contract' | 'cv' | 'certificate' | 'other'
export interface EmployeeDocument {
  id: Id
  employee_id: Id
  kind: EmployeeDocumentKind
  name: string
  path: string
  uploaded_at: ISODateTime
}

export type EmployeeAssetStatus = 'assigned' | 'returned' | 'lost'
export interface EmployeeAsset {
  id: Id
  employee_id: Id
  name: string
  tag: string
  assigned_on: ISODate
  returned_on: ISODate | null
  status: EmployeeAssetStatus
}

export interface OnboardingChecklistItem {
  id: Id
  employee_id: Id
  label: string
  done: boolean
  done_at: ISODateTime | null
}
export type OnboardingChecklist = OnboardingChecklistItem

// ---------- Attendance ----------
export interface AttendancePolicy {
  shift_start: string // '09:00'
  shift_end: string // '18:00'
  grace_minutes: number
  standard_minutes: number
  idle_timeout_minutes: number
  lunch_cap_minutes: number
  late_penalty_rule: { lates_per_penalty: number; penalty_days: number }
  weekend_days: number[] // 0 = Sunday
}

export interface Holiday {
  id: Id
  date: ISODate
  name: string
}

export type AttendanceDayStatus =
  | 'not_started'
  | 'working'
  | 'on_break'
  | 'ended'
  | 'on_leave'
  | 'holiday'
  | 'absent'

export interface AttendanceDay {
  id: Id
  employee_id: Id
  date: ISODate
  status: AttendanceDayStatus
  first_in_at: ISODateTime | null
  last_out_at: ISODateTime | null
  work_seconds: number
  break_seconds: number
  late_minutes: number
  is_regularized: boolean
}

export type SegmentType = 'work' | 'break'
export type BreakCategory = 'short' | 'tea' | 'lunch' | 'official' | 'idle' | 'signed_out' | 'offline'
export type SegmentSource = 'login' | 'logout' | 'idle_sweep' | 'offline' | 'manual'

export interface TimeSegment {
  id: Id
  attendance_day_id: Id
  type: SegmentType
  break_category: BreakCategory | null
  started_at: ISODateTime
  ended_at: ISODateTime | null
  note: string | null
  source: SegmentSource
}

export interface TaskTimeEntry {
  id: Id
  time_segment_id: Id
  task_id: Id
  employee_id: Id
  started_at: ISODateTime
  ended_at: ISODateTime | null
  seconds: number
}

export type RegularizationStatus = 'pending' | 'approved' | 'rejected'
export interface RegularizationRequest {
  id: Id
  attendance_day_id: Id
  employee_id: Id
  reason: string
  status: RegularizationStatus
  decided_by: Id | null
  decided_at: ISODateTime | null
  note: string | null
  created_at: ISODateTime
}

// ---------- Leave ----------
export interface LeaveType {
  id: Id
  name: string
  annual_quota: number
  is_paid: boolean
  carry_forward: boolean
  allows_half_day: boolean
}

export interface LeaveBalance {
  id: Id
  employee_id: Id
  leave_type_id: Id
  year: number
  entitled: number
  used: number
  pending: number
}

export type LeaveStatus = 'pending_lead' | 'pending_hr' | 'approved' | 'rejected' | 'cancelled'
export type HalfDay = 'none' | 'first_half' | 'second_half'

export interface LeaveRequest {
  id: Id
  employee_id: Id
  leave_type_id: Id
  starts_on: ISODate
  ends_on: ISODate
  half_day: HalfDay
  days: number
  reason: string
  attachment_path: string | null
  status: LeaveStatus
  created_at: ISODateTime
}

export type ApprovalDecision = 'approved' | 'rejected'
export interface LeaveApproval {
  id: Id
  leave_request_id: Id
  stage: 'lead' | 'hr'
  decided_by: Id
  decision: ApprovalDecision
  note: string | null
  decided_at: ISODateTime
}

// ---------- Payroll ----------
export type PayrollRunStatus = 'draft' | 'review' | 'approved' | 'paid'
export interface PayrollRun {
  id: Id
  year: number
  month: number // 1-12
  status: PayrollRunStatus
  approved_by: Id | null
  approved_at: ISODateTime | null
  paid_at: ISODateTime | null
  payment_reference: string | null
  locked_at: ISODateTime | null
}

export interface PayrollItem {
  id: Id
  run_id: Id
  employee_id: Id
  salary_structure_id: Id
  standard_minutes: number
  worked_minutes: number
  overtime_minutes: number
  unpaid_leave_days: number
  late_count: number
  gross: number
  overtime_pay: number
  unpaid_deduction: number
  late_deduction: number
  tax: number
  pf: number
  net: number
  bank_account_id: Id | null
  payslip_path: string | null
}

export type PayrollAdjustmentKind = 'bonus' | 'deduction'
export interface PayrollAdjustment {
  id: Id
  item_id: Id
  kind: PayrollAdjustmentKind
  label: string
  amount: number
  note: string | null
  created_by: Id
}

// ---------- Billing ----------
export type Currency = 'BDT' | 'USD' | 'EUR'

export interface Client {
  id: Id
  name: string
  email: string
  address: string
  currency: Currency
  default_rate: number
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void'
export interface Invoice {
  id: Id
  number: string // VIV-2026-0042
  client_id: Id
  project_id: Id | null
  issued_on: ISODate
  due_on: ISODate
  currency: Currency
  subtotal: number
  tax_percent: number
  discount: number
  total: number
  paid_total: number
  status: InvoiceStatus
  notes: string | null
  pdf_path: string | null
}

export interface InvoiceLine {
  id: Id
  invoice_id: Id
  description: string
  qty: number
  unit_price: number
  amount: number
}

export interface InvoicePayment {
  id: Id
  invoice_id: Id
  paid_on: ISODate
  amount: number
  method: string
  reference: string | null
}

export type ClaimStatus = 'draft' | 'submitted' | 'verified' | 'approved' | 'paid'
export interface ContractorClaim {
  id: Id
  employee_id: Id
  year: number
  month: number
  tracked_minutes: number
  claimed_minutes: number
  rate: number
  fixed_amount: number | null
  total: number
  status: ClaimStatus
  verified_by: Id | null
  approved_by: Id | null
  paid_at: ISODateTime | null
  bank_account_id: Id | null
  pdf_path: string | null
}

// ---------- Work ----------
export type ProjectStatus = 'active' | 'paused' | 'done'
export type BillingType = 'retainer' | 'hourly' | 'fixed' | 'internal'

export interface Project {
  id: Id
  key: string // PULSE
  name: string
  client_id: Id | null
  lead_employee_id: Id
  status: ProjectStatus
  billing_type: BillingType
  rate: number | null
}

export interface ProjectMember {
  project_id: Id
  employee_id: Id
}

export interface BoardColumn {
  id: Id
  project_id: Id
  name: string
  position: number
  is_done: boolean
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export interface Task {
  id: Id
  project_id: Id
  number: number
  key: string // PULSE-142 (derived: project.key + number)
  title: string
  body_md: string
  column_id: Id
  priority: TaskPriority
  assignee_id: Id | null
  reporter_id: Id
  estimate_minutes: number | null
  due_on: ISODate | null
  position: number
  created_at: ISODateTime
}

export interface Label {
  id: Id
  project_id: Id | null
  name: string
  color: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent'
}

export interface TaskLabel {
  task_id: Id
  label_id: Id
}

export interface Subtask {
  id: Id
  task_id: Id
  title: string
  done: boolean
  position: number
}

export interface TaskComment {
  id: Id
  task_id: Id
  author_id: Id
  body: string
  created_at: ISODateTime
}

export type AttachableType = 'task' | 'task_comment' | 'message' | 'leave_request'
export interface Attachment {
  id: Id
  attachable_type: AttachableType
  attachable_id: Id
  name: string
  mime: string
  size: number
  path: string // object/data URL in the mock
  created_at: ISODateTime
}

export interface TaskActivity {
  id: Id
  task_id: Id
  actor_id: Id
  text: string
  at: ISODateTime
}

// ---------- Chat ----------
export type ConversationType = 'dm' | 'team' | 'project' | 'group'
export interface Conversation {
  id: Id
  type: ConversationType
  name: string | null
  team_id: Id | null
  project_id: Id | null
}

export interface ConversationMember {
  conversation_id: Id
  employee_id: Id
  last_read_message_id: Id | null
}

export interface MessageAttachment {
  name: string
  mime: string
  size: number
  path: string
}

export interface Message {
  id: Id
  conversation_id: Id
  author_id: Id
  body: string
  attachments: MessageAttachment[]
  created_at: ISODateTime
}

// ---------- Platform ----------
export type NotificationKind =
  | 'leave'
  | 'regularization'
  | 'claim'
  | 'payroll'
  | 'invoice'
  | 'mention'

export interface Notification {
  id: Id
  employee_id: Id
  kind: NotificationKind
  title: string
  body: string | null
  link: string
  read_at: ISODateTime | null
  created_at: ISODateTime
}

export interface ActivityLogEntry {
  id: Id
  subject_type: string
  subject_id: Id
  actor_id: Id
  description: string
  properties: Record<string, unknown> | null
  created_at: ISODateTime
}

export interface Setting {
  key: string
  value: string | number | boolean | null
}

// ---------- Cross-cutting ----------
export type Ability =
  | 'view_team'
  | 'approve_leave_lead'
  | 'approve_leave_hr'
  | 'manage_people'
  | 'manage_payroll'
  | 'approve_payroll'
  | 'manage_billing'
  | 'verify_claims'
  | 'approve_claims'
  | 'manage_projects'
  | 'manage_settings'

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent'
