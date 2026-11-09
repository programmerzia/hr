import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Employee, PersonaRole, AttendanceDay, BreakCategory, BreakRecord, 
  KanbanTask, KanbanColumnId, TaskAttachment, LeaveRequest, 
  PayrollRecord, Invoice, InvoiceStatus, SalaryStructure, ThemeMode 
} from '../types';
import { 
  MOCK_EMPLOYEES, INITIAL_ATTENDANCE_TEAM, INITIAL_KANBAN_TASKS, 
  INITIAL_LEAVE_REQUESTS, INITIAL_PAYROLL_RECORDS, INITIAL_INVOICES,
  generateMockScreenshot
} from '../data/mockData';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}

interface AppContextType {
  // Theme
  theme: ThemeMode;
  toggleTheme: () => void;

  // Authentication & Session
  isAuthenticated: boolean;
  login: (user: Employee) => void;
  logout: (mode: 'break' | 'end_shift' | 'sign_out') => void;
  showLogoutModal: boolean;
  setShowLogoutModal: (show: boolean) => void;

  // Persona & User
  currentRole: PersonaRole;
  currentUser: Employee;
  switchRole: (role: PersonaRole) => void;
  
  // Navigation
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // Employees & Onboarding
  employees: Employee[];
  addEmployee: (newEmp: Partial<Employee>) => void;
  updateEmployeeSalary: (empId: string, newSalary: SalaryStructure) => void;
  selectedEmployeeProfile: Employee | null;
  setSelectedEmployeeProfile: (emp: Employee | null) => void;

  // Attendance & Break Engine
  myAttendance: AttendanceDay;
  teamAttendance: AttendanceDay[];
  startShift: () => void;
  takeBreak: (category?: BreakCategory) => void;
  resumeShift: () => void;
  endShift: () => void;
  regularizeAttendance: (id: string, reason: string) => void;

  // Kanban & Tasks
  tasks: KanbanTask[];
  activeTaskModal: KanbanTask | null;
  setActiveTaskModal: (task: KanbanTask | null) => void;
  moveTask: (taskId: string, targetCol: KanbanColumnId) => void;
  addTask: (task: Partial<KanbanTask>) => void;
  attachScreenshotToTask: (taskId: string, fileData: { name: string; url: string; isClipboardPaste?: boolean; sizeBytes?: number }) => void;
  addCommentToTask: (taskId: string, text: string, attachedImages?: string[]) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  activeTrackingTaskId: string | null;
  toggleTaskTimer: (taskId: string) => void;

  // Leaves
  leaves: LeaveRequest[];
  submitLeaveRequest: (type: any, startDate: string, endDate: string, reason: string) => void;
  approveLeaveTL: (id: string) => void;
  approveLeaveHR: (id: string) => void;
  rejectLeave: (id: string, reason: string) => void;

  // Payroll
  payroll: PayrollRecord[];
  activePayslipModal: PayrollRecord | null;
  setActivePayslipModal: (record: PayrollRecord | null) => void;
  approvePayroll: (id: string) => void;
  disburseAllPayroll: () => void;

  // Invoicing & Internal Vouchers
  invoices: Invoice[];
  activeInvoiceModal: Invoice | null;
  setActiveInvoiceModal: (invoice: Invoice | null) => void;
  updateInvoiceStatus: (id: string, status: InvoiceStatus) => void;
  createInvoiceFromProject: (projectName: string, clientName: string, hours: number, rate: number) => void;
  createInternalVoucher: (data: Partial<Invoice>) => void;
  verifyVoucherTL: (id: string) => void;
  approveVoucherFinance: (id: string) => void;

  // Toasts
  toasts: ToastMessage[];
  addToast: (title: string, description?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme State
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('vivacom_theme') as ThemeMode;
    return saved || 'dark';
  });

  // Apply Theme class to document root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('vivacom_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);

  // Persona & User
  const [currentRole, setCurrentRole] = useState<PersonaRole>('employee');
  const [currentUser, setCurrentUser] = useState<Employee>(MOCK_EMPLOYEES[0]); // Rafiq Ahmed
  const [activeTab, setActiveTab] = useState<string>('attendance');

  // Employees List
  const [employees, setEmployees] = useState<Employee[]>(MOCK_EMPLOYEES);
  const [selectedEmployeeProfile, setSelectedEmployeeProfile] = useState<Employee | null>(null);

  // Attendance state
  const [teamAttendance, setTeamAttendance] = useState<AttendanceDay[]>(INITIAL_ATTENDANCE_TEAM);
  const [myAttendance, setMyAttendance] = useState<AttendanceDay>(INITIAL_ATTENDANCE_TEAM[0]);

  // Tasks, Leaves, Payroll, Invoices
  const [tasks, setTasks] = useState<KanbanTask[]>(INITIAL_KANBAN_TASKS);
  const [activeTaskModal, setActiveTaskModal] = useState<KanbanTask | null>(null);
  const [activeTrackingTaskId, setActiveTrackingTaskId] = useState<string | null>('VIVA-104');
  const [leaves, setLeaves] = useState<LeaveRequest[]>(INITIAL_LEAVE_REQUESTS);
  const [payroll, setPayroll] = useState<PayrollRecord[]>(INITIAL_PAYROLL_RECORDS);
  const [activePayslipModal, setActivePayslipModal] = useState<PayrollRecord | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [activeInvoiceModal, setActiveInvoiceModal] = useState<Invoice | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (title: string, description?: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Switch role helper
  const switchRole = (newRole: PersonaRole) => {
    setCurrentRole(newRole);
    let targetUser = MOCK_EMPLOYEES[0];
    if (newRole === 'team_lead') targetUser = MOCK_EMPLOYEES[1]; // Tanvir
    else if (newRole === 'hr') targetUser = MOCK_EMPLOYEES[2]; // Nasrin
    else if (newRole === 'management') targetUser = MOCK_EMPLOYEES[3]; // Tariqul

    setCurrentUser(targetUser);

    const matchedAtt = teamAttendance.find(a => a.userId === targetUser.id);
    if (matchedAtt) {
      setMyAttendance(matchedAtt);
    }

    addToast(`Switched Persona to ${targetUser.name}`, `Now viewing workspace as ${targetUser.designation} (${newRole.toUpperCase()})`, 'info');
  };

  // Real-time ticking engine for active session and breaks
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isAuthenticated) return;

      // Tick myAttendance
      setMyAttendance(prev => {
        if (!prev) return prev;
        if (prev.status === 'active') {
          return {
            ...prev,
            productionSeconds: prev.productionSeconds + 1,
            grossSeconds: prev.grossSeconds + 1,
          };
        }
        if (prev.status === 'on_break') {
          return {
            ...prev,
            breakSeconds: prev.breakSeconds + 1,
            grossSeconds: prev.grossSeconds + 1,
            currentBreakDurationSeconds: (prev.currentBreakDurationSeconds || 0) + 1,
          };
        }
        return prev;
      });

      // Tick tracked task seconds
      if (activeTrackingTaskId) {
        setTasks(prevTasks => prevTasks.map(t => {
          if (t.id === activeTrackingTaskId) {
            return {
              ...t,
              spentProductionSeconds: t.spentProductionSeconds + 1,
            };
          }
          return t;
        }));
      }

      // Also tick team members
      setTeamAttendance(prevList => {
        return prevList.map(item => {
          if (item.status === 'active') {
            return {
              ...item,
              productionSeconds: item.productionSeconds + 1,
              grossSeconds: item.grossSeconds + 1,
            };
          }
          if (item.status === 'on_break') {
            return {
              ...item,
              breakSeconds: item.breakSeconds + 1,
              grossSeconds: item.grossSeconds + 1,
              currentBreakDurationSeconds: (item.currentBreakDurationSeconds || 0) + 1,
            };
          }
          return item;
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, activeTrackingTaskId]);

  // LOGIN & LOGOUT LIFECYCLE
  const login = (user: Employee) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    setCurrentRole(user.role);

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMyAttendance(prev => {
      // If was on break or shift not started, transition to active
      if (prev.status === 'on_break') {
        const updatedBreaks = prev.breaks.map((b, idx) => {
          if (idx === 0 && !b.endTime) {
            return {
              ...b,
              endTime: nowStr,
              durationSeconds: prev.currentBreakDurationSeconds || 120,
            };
          }
          return b;
        });

        const updated: AttendanceDay = {
          ...prev,
          status: 'active',
          currentBreakDurationSeconds: undefined,
          breaks: updatedBreaks,
        };
        setTeamAttendance(team => team.map(m => m.userId === updated.userId ? updated : m));
        addToast(`Welcome back, ${user.name}!`, `Break ended at ${nowStr}. Production timer resumed.`, 'success');
        return updated;
      }

      if (prev.status === 'shift_not_started' || prev.status === 'absent') {
        const updated: AttendanceDay = {
          ...prev,
          status: 'active',
          firstLoginTime: nowStr,
          productionSeconds: 0,
          grossSeconds: 0,
        };
        setTeamAttendance(team => team.map(m => m.userId === updated.userId ? updated : m));
        addToast(`Good day, ${user.name}!`, `Day Shift started at ${nowStr}. Attendance clock-in registered.`, 'success');
        return updated;
      }

      return prev;
    });
  };

  const logout = (mode: 'break' | 'end_shift' | 'sign_out') => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (mode === 'break') {
      takeBreak('Lunch Break');
      setIsAuthenticated(false);
      setShowLogoutModal(false);
      addToast('Logged Out on Break', `Off-time lapse is counting until you log back in.`, 'warning');
      return;
    }

    if (mode === 'end_shift') {
      endShift();
      setIsAuthenticated(false);
      setShowLogoutModal(false);
      addToast('Day Shift Concluded', `Final punch-out at ${nowStr}. See you tomorrow!`, 'info');
      return;
    }

    // Quick sign out
    setIsAuthenticated(false);
    setShowLogoutModal(false);
    addToast('Signed Out', 'Session securely closed.', 'info');
  };

  // Attendance Actions
  const startShift = () => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMyAttendance(prev => {
      const updated: AttendanceDay = {
        ...prev,
        status: 'active',
        firstLoginTime: prev.firstLoginTime || nowStr,
      };
      setTeamAttendance(team => team.map(m => m.userId === updated.userId ? updated : m));
      return updated;
    });
    addToast('Day Shift Started', `Clock-in registered at ${nowStr}. Production timer is now running.`, 'success');
  };

  const takeBreak = (category: BreakCategory = 'Lunch Break') => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newBreak: BreakRecord = {
      id: 'b-' + Date.now(),
      category,
      startTime: nowStr,
      durationSeconds: 0,
      reason: `${category} initiated`
    };

    setMyAttendance(prev => {
      const updated: AttendanceDay = {
        ...prev,
        status: 'on_break',
        currentBreakDurationSeconds: 0,
        breaks: [newBreak, ...prev.breaks]
      };
      setTeamAttendance(team => team.map(m => m.userId === updated.userId ? updated : m));
      return updated;
    });

    addToast(`On Break: ${category}`, `Break time tracking started at ${nowStr}. Off-time lapse is being calculated.`, 'warning');
  };

  const resumeShift = () => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMyAttendance(prev => {
      const updatedBreaks = prev.breaks.map((b, idx) => {
        if (idx === 0 && !b.endTime) {
          return {
            ...b,
            endTime: nowStr,
            durationSeconds: prev.currentBreakDurationSeconds || 60,
          };
        }
        return b;
      });

      const updated: AttendanceDay = {
        ...prev,
        status: 'active',
        currentBreakDurationSeconds: undefined,
        breaks: updatedBreaks,
      };
      setTeamAttendance(team => team.map(m => m.userId === updated.userId ? updated : m));
      return updated;
    });

    addToast('Shift Resumed', `Re-login recorded at ${nowStr}. Lapse added to break log; production timer resumed.`, 'success');
  };

  const endShift = () => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMyAttendance(prev => {
      const updated: AttendanceDay = {
        ...prev,
        status: 'shift_ended',
        lastLogoutTime: nowStr,
      };
      setTeamAttendance(team => team.map(m => m.userId === updated.userId ? updated : m));
      return updated;
    });

    addToast('Shift Concluded', `Final punch-out at ${nowStr}. Daily production & break summary recorded.`, 'info');
  };

  const regularizeAttendance = (id: string, reason: string) => {
    setTeamAttendance(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          isRegularized: true,
          status: 'active',
          productionSeconds: 28800, // 8 hours standard
        };
      }
      return item;
    }));
    addToast('Attendance Regularized', `Approved adjustment for attendance record. Reason: ${reason}`, 'success');
  };

  // EMPLOYEE MANAGEMENT & ONBOARDING
  const addEmployee = (newEmpData: Partial<Employee>) => {
    const newId = 'u-' + (employees.length + 1);
    const empIdStr = `VIVA-EMP-${100 + employees.length + 1}`;

    const gross = newEmpData.salary?.grossMonthly || 80000;
    const computedSalary: SalaryStructure = {
      grossMonthly: gross,
      basic: Math.round(gross * 0.5),
      houseRent: Math.round(gross * 0.25),
      medical: Math.round(gross * 0.1),
      conveyance: Math.round(gross * 0.05),
      providentFund: Math.round(gross * 0.05),
      taxDeduction: Math.round(gross * 0.05),
      hourlyRate: Math.round(gross / 176),
    };

    const newEmp: Employee = {
      id: newId,
      employeeId: empIdStr,
      name: newEmpData.name || 'New Staff Member',
      email: newEmpData.email || `${(newEmpData.name || 'staff').toLowerCase().replace(/\s+/g, '.')}@vivacom.com`,
      phone: newEmpData.phone || '+880 1700-000000',
      nid: newEmpData.nid || '19950000000000000',
      avatar: newEmpData.avatar || `https://images.unsplash.com/photo-${1534528741775 + employees.length}?w=150&auto=format&fit=crop&q=80`,
      role: newEmpData.role || 'employee',
      designation: newEmpData.designation || 'Software Engineer',
      department: newEmpData.department || 'Engineering',
      joiningDate: newEmpData.joiningDate || new Date().toISOString().split('T')[0],
      employmentType: newEmpData.employmentType || 'Full-Time',
      status: 'Active',
      supervisorName: newEmpData.supervisorName || 'Tanvir Hossain',
      salary: computedSalary,
      bankDetails: newEmpData.bankDetails || {
        bankName: 'City Bank Ltd',
        accountName: newEmpData.name || 'Staff Member',
        accountNumber: '1102839999999',
        routingNumber: '090273819',
        branch: 'Gulshan Branch'
      },
      assets: newEmpData.assets || ['MacBook Air M3 15"', 'Slack Access', 'GitHub Organization Invite'],
      assignedProjects: newEmpData.assignedProjects || ['Vivacom Pulse Core'],
      onboardingProgress: 85,
    };

    setEmployees(prev => [newEmp, ...prev]);

    // Also auto-provision them on the attendance radar & payroll!
    const newAtt: AttendanceDay = {
      id: 'att-' + newId,
      userId: newId,
      userName: newEmp.name,
      userAvatar: newEmp.avatar,
      department: newEmp.department,
      date: new Date().toISOString().split('T')[0],
      status: 'shift_not_started',
      productionSeconds: 0,
      breakSeconds: 0,
      grossSeconds: 0,
      breaks: [],
    };
    setTeamAttendance(prev => [...prev, newAtt]);

    const newPayroll: PayrollRecord = {
      id: 'pr-' + newId,
      userId: newId,
      userName: newEmp.name,
      userAvatar: newEmp.avatar,
      designation: newEmp.designation,
      department: newEmp.department,
      month: 'November 2026',
      baseSalary: newEmp.salary.grossMonthly,
      salaryBreakdown: newEmp.salary,
      standardHours: 176,
      actualProductionHours: 176,
      totalBreakHours: 18,
      overtimeHours: 0,
      overtimePay: 0,
      unpaidLeaveDays: 0,
      unpaidLeaveDeduction: 0,
      latePenaltyDeduction: 0,
      taxDeduction: newEmp.salary.taxDeduction,
      performanceBonus: 0,
      grossEarnings: newEmp.salary.grossMonthly,
      totalDeductions: newEmp.salary.taxDeduction,
      netPayable: newEmp.salary.grossMonthly - newEmp.salary.taxDeduction,
      paymentStatus: 'draft',
      bankAccountRef: `${newEmp.bankDetails.bankName} •••• ${newEmp.bankDetails.accountNumber.slice(-4)}`
    };
    setPayroll(prev => [...prev, newPayroll]);

    addToast('Employee Onboarded', `${newEmp.name} (${newEmp.employeeId}) added to directory, attendance radar & payroll.`, 'success');
  };

  const updateEmployeeSalary = (empId: string, newSalary: SalaryStructure) => {
    setEmployees(prev => prev.map(e => e.id === empId ? { ...e, salary: newSalary } : e));
    setPayroll(prev => prev.map(p => p.userId === empId ? {
      ...p,
      baseSalary: newSalary.grossMonthly,
      salaryBreakdown: newSalary,
      netPayable: newSalary.grossMonthly - newSalary.taxDeduction,
    } : p));
    addToast('Salary Structure Updated', 'New compensation package saved and updated on payroll ledger.', 'success');
  };

  // Kanban & Task Actions
  const moveTask = (taskId: string, targetCol: KanbanColumnId) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return { ...t, columnId: targetCol };
      }
      return t;
    }));
    if (activeTaskModal && activeTaskModal.id === taskId) {
      setActiveTaskModal(prev => prev ? { ...prev, columnId: targetCol } : null);
    }
  };

  const addTask = (newTaskData: Partial<KanbanTask>) => {
    const newTask: KanbanTask = {
      id: 'VIVA-' + (120 + tasks.length),
      projectKey: 'PULSE',
      projectName: newTaskData.projectName || 'Vivacom Pulse Core',
      title: newTaskData.title || 'Untitled Task',
      description: newTaskData.description || 'No description provided.',
      columnId: newTaskData.columnId || 'todo',
      priority: newTaskData.priority || 'medium',
      assignee: newTaskData.assignee || currentUser,
      reporter: currentUser,
      estimatedHours: newTaskData.estimatedHours || 8,
      spentProductionSeconds: 0,
      dueDate: newTaskData.dueDate || '2026-11-20',
      attachments: [],
      comments: [],
      labels: newTaskData.labels || ['Feature'],
      subtasks: [
        { id: 'st-sub-1', text: 'Initial design review', completed: false },
        { id: 'st-sub-2', text: 'Code implementation', completed: false }
      ]
    };

    setTasks(prev => [newTask, ...prev]);
    addToast('Task Created', `Created ${newTask.id}: ${newTask.title}`, 'success');
  };

  const attachScreenshotToTask = (taskId: string, fileData: { name: string; url: string; isClipboardPaste?: boolean; sizeBytes?: number }) => {
    const newAttachment: TaskAttachment = {
      id: 'att-' + Date.now(),
      name: fileData.name || `screenshot-${Date.now().toString().slice(-4)}.png`,
      url: fileData.url,
      fileType: 'image/png',
      sizeBytes: fileData.sizeBytes || 185400,
      uploadedAt: 'Just now',
      uploadedBy: currentUser.name,
      isClipboardPaste: fileData.isClipboardPaste ?? true,
    };

    setTasks(prev => prev.map(task => {
      if (task.id === taskId) {
        const updated = {
          ...task,
          attachments: [newAttachment, ...task.attachments],
        };
        if (activeTaskModal && activeTaskModal.id === taskId) {
          setActiveTaskModal(updated);
        }
        return updated;
      }
      return task;
    }));

    addToast(
      fileData.isClipboardPaste ? 'Screenshot Pasted from Clipboard!' : 'Attachment Uploaded',
      `Attached ${newAttachment.name} to task ${taskId}.`,
      'success'
    );
  };

  const addCommentToTask = (taskId: string, text: string, attachedImages?: string[]) => {
    const newComment = {
      id: 'comm-' + Date.now(),
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      createdAt: 'Just now',
      text,
      attachedImages
    };

    setTasks(prev => prev.map(task => {
      if (task.id === taskId) {
        const updated = {
          ...task,
          comments: [...task.comments, newComment]
        };
        if (activeTaskModal && activeTaskModal.id === taskId) {
          setActiveTaskModal(updated);
        }
        return updated;
      }
      return task;
    }));
  };

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const updatedSubtasks = t.subtasks.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st);
        const updated = { ...t, subtasks: updatedSubtasks };
        if (activeTaskModal && activeTaskModal.id === taskId) {
          setActiveTaskModal(updated);
        }
        return updated;
      }
      return t;
    }));
  };

  const toggleTaskTimer = (taskId: string) => {
    if (activeTrackingTaskId === taskId) {
      setActiveTrackingTaskId(null);
      addToast('Time Tracking Paused', `Stopped tracking production on task ${taskId}`, 'info');
    } else {
      setActiveTrackingTaskId(taskId);
      const targetTask = tasks.find(t => t.id === taskId);
      if (targetTask) {
        setMyAttendance(prev => ({
          ...prev,
          currentTaskId: taskId,
          currentTaskTitle: `${taskId}: ${targetTask.title}`
        }));
      }
      addToast('Active Time Tracking', `Now logging attendance production directly into ${taskId}`, 'success');
    }
  };

  // Leave Actions
  const submitLeaveRequest = (type: any, startDate: string, endDate: string, reason: string) => {
    const newReq: LeaveRequest = {
      id: 'lr-' + (leaves.length + 1),
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      department: currentUser.department,
      type,
      startDate,
      endDate,
      daysCount: 2,
      reason,
      status: 'pending_tl',
      appliedAt: new Date().toISOString().split('T')[0]
    };
    setLeaves(prev => [newReq, ...prev]);
    addToast('Leave Request Submitted', `Forwarded to Team Lead for review.`, 'success');
  };

  const approveLeaveTL = (id: string) => {
    setLeaves(prev => prev.map(item => item.id === id ? { ...item, status: 'pending_hr', tlApprovedBy: currentUser.name } : item));
    addToast('Stage 1 Approved', 'Leave request recommended and forwarded to HR.', 'success');
  };

  const approveLeaveHR = (id: string) => {
    setLeaves(prev => prev.map(item => item.id === id ? { ...item, status: 'approved', hrApprovedBy: currentUser.name } : item));
    addToast('Leave Finalized & Approved', 'Attendance calendar updated; no absenteeism penalty.', 'success');
  };

  const rejectLeave = (id: string, reason: string) => {
    setLeaves(prev => prev.map(item => item.id === id ? { ...item, status: 'rejected', rejectionReason: reason } : item));
    addToast('Leave Rejected', `Request rejected with note: ${reason}`, 'warning');
  };

  // Payroll Actions
  const approvePayroll = (id: string) => {
    setPayroll(prev => prev.map(item => item.id === id ? { ...item, paymentStatus: 'approved' } : item));
    addToast('Payroll Certified & Locked', 'Payslip certified for bank disbursement.', 'success');
  };

  const disburseAllPayroll = () => {
    setPayroll(prev => prev.map(item => ({ ...item, paymentStatus: 'paid', disbursementDate: '2026-11-10' })));
    addToast('Batch Disbursal Successful', 'Direct bank wire instructions transmitted via Bangladesh Electronic Funds Transfer Network (BEFTN).', 'success');
  };

  // Invoicing & Internal Vouchers
  const updateInvoiceStatus = (id: string, status: InvoiceStatus) => {
    setInvoices(prev => prev.map(item => item.id === id ? { ...item, status } : item));
    addToast('Status Updated', `Item status changed to ${status.toUpperCase()}`, 'info');
  };

  const createInvoiceFromProject = (projectName: string, clientName: string, hours: number, rate: number) => {
    const amount = hours * rate;
    const tax = amount * 0.05;
    const newInv: Invoice = {
      id: 'inv-' + (invoices.length + 103),
      invoiceNumber: `INV-2026-0${invoices.length + 90}`,
      type: 'client_invoice',
      clientName,
      clientEmail: `finance@${clientName.toLowerCase().replace(/\s+/g, '')}.com`,
      clientAddress: 'Corporate Suites, Innovation Park, Dhaka',
      projectName,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: '2026-11-30',
      status: 'draft',
      currency: 'USD',
      taxRatePercent: 5,
      discountAmount: 0,
      subtotal: amount,
      taxAmount: tax,
      total: amount + tax,
      notes: 'Generated automatically from verified employee production hours.',
      items: [
        {
          id: 'it-gen-1',
          description: `Engineering & Development Hours on ${projectName}`,
          quantityHours: hours,
          unitRate: rate,
          amount
        }
      ]
    };

    setInvoices(prev => [newInv, ...prev]);
    addToast('Invoice Created', `Drafted ${newInv.invoiceNumber} for ${clientName}`, 'success');
  };

  const createInternalVoucher = (data: Partial<Invoice>) => {
    const newVoucher: Invoice = {
      id: 'vch-' + (invoices.length + 200),
      invoiceNumber: `VCH-2026-0${invoices.length + 45}`,
      type: 'internal_voucher',
      projectName: data.projectName || 'Internal Operations & Cloud Infrastructure',
      claimantEmployeeId: currentUser.id,
      claimantEmployeeName: currentUser.name,
      claimantAvatar: currentUser.avatar,
      voucherCategory: data.voucherCategory || 'Reimbursement',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: '2026-11-20',
      status: 'submitted',
      currency: 'BDT',
      taxRatePercent: 0,
      discountAmount: 0,
      subtotal: data.subtotal || 5000,
      taxAmount: 0,
      total: data.subtotal || 5000,
      notes: data.notes || 'Internal expense claim with receipts attached.',
      items: data.items || [
        {
          id: 'vit-new-1',
          description: data.notes || 'Expense item',
          quantityHours: 1,
          unitRate: data.subtotal || 5000,
          amount: data.subtotal || 5000
        }
      ]
    };

    setInvoices(prev => [newVoucher, ...prev]);
    addToast('Voucher Submitted', `Expense claim ${newVoucher.invoiceNumber} submitted for Team Lead & Finance verification.`, 'success');
  };

  const verifyVoucherTL = (id: string) => {
    setInvoices(prev => prev.map(item => item.id === id ? { ...item, status: 'verified_tl', verifiedBy: currentUser.name } : item));
    addToast('Voucher Verified', 'Team Lead verified expense; routed to HR/Finance for payout approval.', 'success');
  };

  const approveVoucherFinance = (id: string) => {
    setInvoices(prev => prev.map(item => item.id === id ? { ...item, status: 'approved', approvedBy: currentUser.name } : item));
    addToast('Voucher Approved for Payout', 'Disbursal scheduled with next salary payroll cycle.', 'success');
  };

  return (
    <AppContext.Provider value={{
      theme,
      toggleTheme,
      isAuthenticated,
      login,
      logout,
      showLogoutModal,
      setShowLogoutModal,
      currentRole,
      currentUser,
      switchRole,
      activeTab,
      setActiveTab,
      employees,
      addEmployee,
      updateEmployeeSalary,
      selectedEmployeeProfile,
      setSelectedEmployeeProfile,
      myAttendance,
      teamAttendance,
      startShift,
      takeBreak,
      resumeShift,
      endShift,
      regularizeAttendance,
      tasks,
      activeTaskModal,
      setActiveTaskModal,
      moveTask,
      addTask,
      attachScreenshotToTask,
      addCommentToTask,
      toggleSubtask,
      activeTrackingTaskId,
      toggleTaskTimer,
      leaves,
      submitLeaveRequest,
      approveLeaveTL,
      approveLeaveHR,
      rejectLeave,
      payroll,
      activePayslipModal,
      setActivePayslipModal,
      approvePayroll,
      disburseAllPayroll,
      invoices,
      activeInvoiceModal,
      setActiveInvoiceModal,
      updateInvoiceStatus,
      createInvoiceFromProject,
      createInternalVoucher,
      verifyVoucherTL,
      approveVoucherFinance,
      toasts,
      addToast,
      dismissToast,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
