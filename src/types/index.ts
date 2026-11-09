export type PersonaRole = 'employee' | 'team_lead' | 'hr' | 'management';
export type ThemeMode = 'dark' | 'light';

export interface SalaryStructure {
  basic: number;
  houseRent: number;
  medical: number;
  conveyance: number;
  providentFund: number;
  taxDeduction: number;
  grossMonthly: number;
  hourlyRate: number;
}

export interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  branch: string;
}

export interface Employee {
  id: string;
  employeeId: string; // e.g. VIVA-EMP-101
  name: string;
  email: string;
  phone: string;
  nid: string;
  avatar: string;
  role: PersonaRole;
  designation: string;
  department: string;
  joiningDate: string;
  employmentType: 'Full-Time' | 'Contractor' | 'Intern';
  status: 'Active' | 'On Leave' | 'Probation' | 'Terminated';
  supervisorName: string;
  salary: SalaryStructure;
  bankDetails: BankDetails;
  assets: string[];
  assignedProjects: string[];
  onboardingProgress: number; // 0 - 100
}

// User compatibility alias
export type User = Employee;

export type AttendanceStatus = 
  | 'shift_not_started' 
  | 'active' 
  | 'on_break' 
  | 'shift_ended' 
  | 'absent';

export type BreakCategory = 'Short Break' | 'Tea Break' | 'Lunch Break' | 'System Inactive' | 'Official Step Out';

export interface BreakRecord {
  id: string;
  category: BreakCategory;
  startTime: string; // HH:mm:ss
  endTime?: string;  // HH:mm:ss
  durationSeconds: number;
  reason?: string;
}

export interface AttendanceDay {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  department: string;
  date: string;
  status: AttendanceStatus;
  firstLoginTime?: string;
  lastLogoutTime?: string;
  productionSeconds: number;
  breakSeconds: number;
  grossSeconds: number;
  breaks: BreakRecord[];
  currentTaskTitle?: string;
  currentTaskId?: string;
  currentBreakDurationSeconds?: number;
  isLateArrival?: boolean;
  isRegularized?: boolean;
}

export type KanbanColumnId = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  fileType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
  isClipboardPaste?: boolean;
}

export interface TaskComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  createdAt: string;
  text: string;
  attachedImages?: string[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface KanbanTask {
  id: string;
  projectKey: string;
  projectName: string;
  title: string;
  description: string;
  columnId: KanbanColumnId;
  priority: TaskPriority;
  assignee: Employee;
  reporter: Employee;
  estimatedHours: number;
  spentProductionSeconds: number;
  dueDate: string;
  attachments: TaskAttachment[];
  comments: TaskComment[];
  labels: string[];
  subtasks: ChecklistItem[];
  isTracking?: boolean;
}

export type LeaveType = 'Casual Leave' | 'Sick Leave' | 'Annual Leave' | 'Unpaid Leave';

export type LeaveStatus = 'pending_tl' | 'pending_hr' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  department: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  status: LeaveStatus;
  appliedAt: string;
  tlApprovedBy?: string;
  hrApprovedBy?: string;
  rejectionReason?: string;
}

export interface PayrollRecord {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  designation: string;
  department: string;
  month: string; // "November 2026"
  baseSalary: number;
  salaryBreakdown: SalaryStructure;
  standardHours: number; // 176h
  actualProductionHours: number;
  totalBreakHours: number;
  overtimeHours: number;
  overtimePay: number;
  unpaidLeaveDays: number;
  unpaidLeaveDeduction: number;
  latePenaltyDeduction: number;
  taxDeduction: number;
  performanceBonus: number;
  grossEarnings: number;
  totalDeductions: number;
  netPayable: number;
  paymentStatus: 'draft' | 'approved' | 'paid';
  disbursementDate?: string;
  bankAccountRef: string;
}

export type InvoiceType = 'employee_salary' | 'client_project';
export type InvoiceStatus = 'draft' | 'submitted' | 'verified_tl' | 'approved' | 'paid' | 'overdue';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  currency: 'BDT' | 'USD' | 'EUR';
  notes?: string;

  // Employee Monthly Salary Invoice fields (Direct production hours & salary claim, no item clutter)
  employeeId?: string;
  employeeName?: string;
  employeeAvatar?: string;
  designation?: string;
  department?: string;
  billingMonth?: string;
  productionHours?: number;
  standardHours?: number;
  baseSalary?: number;
  overtimeHours?: number;
  overtimePay?: number;
  deductions?: number;
  netPayable: number;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  tlVerifiedBy?: string;
  tlVerifiedAt?: string;
  managementApprovedBy?: string;
  managementApprovedAt?: string;
  paidAt?: string;

  // Commercial Client Project Invoice fields
  clientName?: string;
  clientEmail?: string;
  clientAddress?: string;
  projectName?: string;
  billingPeriod?: string;
  scopeDescription?: string;
  total: number;
}
