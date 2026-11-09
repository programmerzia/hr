import { Employee, AttendanceDay, KanbanTask, LeaveRequest, PayrollRecord, Invoice } from '../types';

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 'u-1',
    employeeId: 'VIVA-EMP-101',
    name: 'Rafiq Ahmed',
    email: 'rafiq@vivacom.com',
    phone: '+880 1711-234567',
    nid: '19922692837102941',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'employee',
    designation: 'Senior Full-Stack Engineer',
    department: 'Engineering',
    joiningDate: '2023-03-15',
    employmentType: 'Full-Time',
    status: 'Active',
    supervisorName: 'Tanvir Hossain',
    salary: {
      basic: 60000,
      houseRent: 30000,
      medical: 12000,
      conveyance: 6000,
      providentFund: 6000,
      taxDeduction: 6000,
      grossMonthly: 120000,
      hourlyRate: 35,
    },
    bankDetails: {
      bankName: 'City Bank Ltd',
      accountName: 'Rafiq Ahmed',
      accountNumber: '1102839102847',
      routingNumber: '090273819',
      branch: 'Gulshan Avenue Branch'
    },
    assets: ['MacBook Pro M3 Max 16"', 'Dell UltraSharp 32" 4K', 'YubiKey 5C NFC'],
    assignedProjects: ['Vivacom Pulse Core', 'Vivacom ERP 2.0'],
    onboardingProgress: 100,
  },
  {
    id: 'u-2',
    employeeId: 'VIVA-EMP-102',
    name: 'Tanvir Hossain',
    email: 'tanvir@vivacom.com',
    phone: '+880 1819-876543',
    nid: '19882692837102942',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'team_lead',
    designation: 'Engineering Lead & Scrum Master',
    department: 'Engineering',
    joiningDate: '2021-08-01',
    employmentType: 'Full-Time',
    status: 'Active',
    supervisorName: 'Tariqul Islam',
    salary: {
      basic: 80000,
      houseRent: 40000,
      medical: 16000,
      conveyance: 8000,
      providentFund: 8000,
      taxDeduction: 10000,
      grossMonthly: 160000,
      hourlyRate: 45,
    },
    bankDetails: {
      bankName: 'BRAC Bank PLC',
      accountName: 'Tanvir Hossain',
      accountNumber: '1501203948572',
      routingNumber: '060273811',
      branch: 'Banani Branch'
    },
    assets: ['MacBook Pro M2 Max 16"', 'LG 34" Ultrawide', 'Keychron Q1 Pro'],
    assignedProjects: ['Vivacom Pulse Core', 'Apex Telematics'],
    onboardingProgress: 100,
  },
  {
    id: 'u-3',
    employeeId: 'VIVA-EMP-103',
    name: 'Nasrin Akter',
    email: 'nasrin@vivacom.com',
    phone: '+880 1912-345678',
    nid: '19902692837102943',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    role: 'hr',
    designation: 'Head of People & HR Operations',
    department: 'Human Resources',
    joiningDate: '2022-01-10',
    employmentType: 'Full-Time',
    status: 'Active',
    supervisorName: 'Tariqul Islam',
    salary: {
      basic: 65000,
      houseRent: 32500,
      medical: 13000,
      conveyance: 6500,
      providentFund: 6500,
      taxDeduction: 7000,
      grossMonthly: 130000,
      hourlyRate: 30,
    },
    bankDetails: {
      bankName: 'Eastern Bank Ltd (EBL)',
      accountName: 'Nasrin Akter',
      accountNumber: '1041029384756',
      routingNumber: '095273812',
      branch: 'Gulshan-2 Branch'
    },
    assets: ['MacBook Air M3 15"', 'Dell 27" 4K Monitor'],
    assignedProjects: ['Internal Operations & People Care'],
    onboardingProgress: 100,
  },
  {
    id: 'u-4',
    employeeId: 'VIVA-EMP-100',
    name: 'Tariqul Islam',
    email: 'tariqul@vivacom.com',
    phone: '+880 1713-998877',
    nid: '19822692837102940',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    role: 'management',
    designation: 'Chief Technology Officer (CTO)',
    department: 'Executive Board',
    joiningDate: '2019-06-01',
    employmentType: 'Full-Time',
    status: 'Active',
    supervisorName: 'Board of Directors',
    salary: {
      basic: 125000,
      houseRent: 62500,
      medical: 25000,
      conveyance: 12500,
      providentFund: 12500,
      taxDeduction: 25000,
      grossMonthly: 250000,
      hourlyRate: 60,
    },
    bankDetails: {
      bankName: 'Standard Chartered Bank',
      accountName: 'Tariqul Islam',
      accountNumber: '0182938475601',
      routingNumber: '215273819',
      branch: 'Gulshan Branch'
    },
    assets: ['MacBook Pro M3 Max 16"', 'Apple Studio Display 27"'],
    assignedProjects: ['Architecture Governance', 'All Projects'],
    onboardingProgress: 100,
  },
  {
    id: 'u-5',
    employeeId: 'VIVA-EMP-105',
    name: 'Farhana Yasmin',
    email: 'farhana@vivacom.com',
    phone: '+880 1611-445566',
    nid: '19952692837102945',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    role: 'employee',
    designation: 'Frontend Engineer',
    department: 'Engineering',
    joiningDate: '2024-02-01',
    employmentType: 'Full-Time',
    status: 'Active',
    supervisorName: 'Tanvir Hossain',
    salary: {
      basic: 47500,
      houseRent: 23750,
      medical: 9500,
      conveyance: 4750,
      providentFund: 4750,
      taxDeduction: 3500,
      grossMonthly: 95000,
      hourlyRate: 28,
    },
    bankDetails: {
      bankName: 'Dutch-Bangla Bank (DBBL)',
      accountName: 'Farhana Yasmin',
      accountNumber: '1151203948576',
      routingNumber: '090273899',
      branch: 'Mohakhali Branch'
    },
    assets: ['MacBook Pro M3 14"', 'Dell 27" QHD'],
    assignedProjects: ['Vivacom Pulse Core'],
    onboardingProgress: 100,
  },
  {
    id: 'u-6',
    employeeId: 'VIVA-EMP-106',
    name: 'Mahbubur Rahman',
    email: 'mahbub@vivacom.com',
    phone: '+880 1715-667788',
    nid: '19932692837102946',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    role: 'employee',
    designation: 'Mobile & PWA Developer',
    department: 'Engineering',
    joiningDate: '2023-09-15',
    employmentType: 'Full-Time',
    status: 'Active',
    supervisorName: 'Tanvir Hossain',
    salary: {
      basic: 52500,
      houseRent: 26250,
      medical: 10500,
      conveyance: 5250,
      providentFund: 5250,
      taxDeduction: 4500,
      grossMonthly: 105000,
      hourlyRate: 32,
    },
    bankDetails: {
      bankName: 'BRAC Bank PLC',
      accountName: 'Mahbubur Rahman',
      accountNumber: '1501203948999',
      routingNumber: '060273811',
      branch: 'Uttara Branch'
    },
    assets: ['MacBook Pro M2 14"', 'Pixel 8 Pro (Test Device)', 'iPad Pro 11"'],
    assignedProjects: ['Vivacom Pulse Core', 'Fleet Mobile PWA'],
    onboardingProgress: 100,
  },
  {
    id: 'u-7',
    employeeId: 'VIVA-EMP-107',
    name: 'Sadia Sultana',
    email: 'sadia@vivacom.com',
    phone: '+880 1817-223344',
    nid: '19942692837102947',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    role: 'employee',
    designation: 'QA Automation Lead',
    department: 'Quality Assurance',
    joiningDate: '2023-11-01',
    employmentType: 'Full-Time',
    status: 'Active',
    supervisorName: 'Tanvir Hossain',
    salary: {
      basic: 45000,
      houseRent: 22500,
      medical: 9000,
      conveyance: 4500,
      providentFund: 4500,
      taxDeduction: 3000,
      grossMonthly: 90000,
      hourlyRate: 26,
    },
    bankDetails: {
      bankName: 'Prime Bank Ltd',
      accountName: 'Sadia Sultana',
      accountNumber: '2101203948571',
      routingNumber: '180273811',
      branch: 'Dhanmondi Branch'
    },
    assets: ['Dell Latitude 7440', 'Samsung Test Device Array'],
    assignedProjects: ['Vivacom Pulse Core', 'Invoicing Test Suite'],
    onboardingProgress: 100,
  },
  {
    id: 'u-8',
    employeeId: 'VIVA-EMP-108',
    name: 'Zahid Hasan',
    email: 'zahid@vivacom.com',
    phone: '+880 1918-778899',
    nid: '19892692837102948',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    role: 'employee',
    designation: 'DevOps & Cloud Engineer',
    department: 'Infrastructure',
    joiningDate: '2022-07-15',
    employmentType: 'Full-Time',
    status: 'Active',
    supervisorName: 'Tariqul Islam',
    salary: {
      basic: 70000,
      houseRent: 35000,
      medical: 14000,
      conveyance: 7000,
      providentFund: 7000,
      taxDeduction: 7500,
      grossMonthly: 140000,
      hourlyRate: 38,
    },
    bankDetails: {
      bankName: 'City Bank Ltd',
      accountName: 'Zahid Hasan',
      accountNumber: '1102839102999',
      routingNumber: '090273819',
      branch: 'Kawran Bazar Branch'
    },
    assets: ['ThinkPad X1 Carbon Gen 11', 'Dell 34" Curved Monitor'],
    assignedProjects: ['Cloud Infrastructure', 'Kubernetes Clusters'],
    onboardingProgress: 100,
  }
];

export const MOCK_USERS = MOCK_EMPLOYEES;

// Helper to generate crisp SVG screenshots
export function generateMockScreenshot(label: string, color: string = '#4f46e5'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360" viewBox="0 0 600 360">
    <rect width="600" height="360" rx="12" fill="#0f172a" />
    <rect x="0" y="0" width="600" height="42" rx="12" fill="#1e293b" />
    <circle cx="24" cy="21" r="6" fill="#ef4444" />
    <circle cx="44" cy="21" r="6" fill="#f59e0b" />
    <circle cx="64" cy="21" r="6" fill="#10b981" />
    <text x="90" y="26" fill="#94a3b8" font-family="system-ui" font-size="12" font-weight="600">vivacom-internal-preview // ${label}</text>
    <rect x="24" y="64" width="552" height="60" rx="8" fill="#1e293b" />
    <rect x="44" y="80" width="160" height="14" rx="4" fill="${color}" />
    <rect x="44" y="102" width="280" height="10" rx="3" fill="#334155" />
    <rect x="24" y="140" width="360" height="180" rx="8" fill="#1e293b" />
    <rect x="404" y="140" width="172" height="180" rx="8" fill="#1e293b" />
    <rect x="44" y="160" width="320" height="120" rx="6" fill="#0f172a" />
    <path d="M60 250 L120 190 L180 230 L260 170 L340 240" stroke="${color}" stroke-width="4" stroke-linecap="round" fill="none" />
    <circle cx="260" cy="170" r="5" fill="#38bdf8" />
    <text x="270" y="165" fill="#38bdf8" font-family="monospace" font-size="11">Production: 99.8%</text>
    <rect x="420" y="160" width="140" height="20" rx="4" fill="${color}" opacity="0.3" />
    <rect x="420" y="190" width="140" height="12" rx="3" fill="#334155" />
    <rect x="420" y="210" width="110" height="12" rx="3" fill="#334155" />
    <rect x="420" y="230" width="125" height="12" rx="3" fill="#334155" />
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const INITIAL_ATTENDANCE_TEAM: AttendanceDay[] = [
  {
    id: 'att-1',
    userId: 'u-1',
    userName: 'Rafiq Ahmed',
    userAvatar: MOCK_EMPLOYEES[0].avatar,
    department: 'Engineering',
    date: '2026-11-10',
    status: 'active',
    firstLoginTime: '09:04 AM',
    productionSeconds: 19440, // 5h 24m
    breakSeconds: 2700,      // 45m (Tea + Lunch)
    grossSeconds: 22140,
    currentTaskTitle: 'VIVA-104: Production Hours Calculation Engine',
    currentTaskId: 'VIVA-104',
    breaks: [
      {
        id: 'b-1',
        category: 'Tea Break',
        startTime: '10:45 AM',
        endTime: '11:00 AM',
        durationSeconds: 900,
        reason: 'Morning tea with dev team'
      },
      {
        id: 'b-2',
        category: 'Lunch Break',
        startTime: '01:15 PM',
        endTime: '01:45 PM',
        durationSeconds: 1800,
        reason: 'Lunch in cafeteria'
      }
    ]
  },
  {
    id: 'att-2',
    userId: 'u-2',
    userName: 'Tanvir Hossain',
    userAvatar: MOCK_EMPLOYEES[1].avatar,
    department: 'Engineering',
    date: '2026-11-10',
    status: 'active',
    firstLoginTime: '08:55 AM',
    productionSeconds: 20100, // 5h 35m
    breakSeconds: 1800,      // 30m
    grossSeconds: 21900,
    currentTaskTitle: 'VIVA-102: Sprint Planning & Radar Architecture',
    currentTaskId: 'VIVA-102',
    breaks: [
      {
        id: 'b-3',
        category: 'Lunch Break',
        startTime: '01:00 PM',
        endTime: '01:30 PM',
        durationSeconds: 1800,
        reason: 'Standard lunch'
      }
    ]
  },
  {
    id: 'att-5',
    userId: 'u-5',
    userName: 'Farhana Yasmin',
    userAvatar: MOCK_EMPLOYEES[4].avatar,
    department: 'Engineering',
    date: '2026-11-10',
    status: 'active',
    firstLoginTime: '09:15 AM',
    productionSeconds: 17280, // 4h 48m
    breakSeconds: 2400,
    grossSeconds: 19680,
    currentTaskTitle: 'VIVA-108: Interactive Kanban SC Attach Dock UI',
    currentTaskId: 'VIVA-108',
    breaks: [
      {
        id: 'b-4',
        category: 'Short Break',
        startTime: '11:30 AM',
        endTime: '11:45 AM',
        durationSeconds: 900
      },
      {
        id: 'b-5',
        category: 'Lunch Break',
        startTime: '01:30 PM',
        endTime: '01:55 PM',
        durationSeconds: 1500
      }
    ]
  },
  {
    id: 'att-6',
    userId: 'u-6',
    userName: 'Mahbubur Rahman',
    userAvatar: MOCK_EMPLOYEES[5].avatar,
    department: 'Engineering',
    date: '2026-11-10',
    status: 'on_break',
    firstLoginTime: '09:30 AM',
    productionSeconds: 14400, // 4h 00m
    breakSeconds: 2100,
    grossSeconds: 16500,
    currentTaskTitle: 'VIVA-115: Service Worker & PWA Caching Strategy',
    currentTaskId: 'VIVA-115',
    currentBreakDurationSeconds: 1440, // 24m elapsed
    breaks: [
      {
        id: 'b-6',
        category: 'Lunch Break',
        startTime: '02:00 PM',
        durationSeconds: 1440,
        reason: 'Late lunch'
      }
    ]
  },
  {
    id: 'att-7',
    userId: 'u-7',
    userName: 'Sadia Sultana',
    userAvatar: MOCK_EMPLOYEES[6].avatar,
    department: 'Quality Assurance',
    date: '2026-11-10',
    status: 'active',
    firstLoginTime: '09:00 AM',
    productionSeconds: 18900,
    breakSeconds: 1800,
    grossSeconds: 20700,
    currentTaskTitle: 'VIVA-112: Invoicing Edge Cases & PDF Layout Verification',
    currentTaskId: 'VIVA-112',
    breaks: [
      {
        id: 'b-7',
        category: 'Lunch Break',
        startTime: '01:00 PM',
        endTime: '01:30 PM',
        durationSeconds: 1800
      }
    ]
  },
  {
    id: 'att-8',
    userId: 'u-8',
    userName: 'Zahid Hasan',
    userAvatar: MOCK_EMPLOYEES[7].avatar,
    department: 'Infrastructure',
    date: '2026-11-10',
    status: 'absent',
    productionSeconds: 0,
    breakSeconds: 0,
    grossSeconds: 0,
    breaks: [],
    isLateArrival: true
  }
];

export const INITIAL_KANBAN_TASKS: KanbanTask[] = [
  {
    id: 'VIVA-101',
    projectKey: 'PULSE',
    projectName: 'Vivacom Pulse Core',
    title: 'Design PWA Service Worker & Push Notification Hub',
    description: 'Implement offline-first attendance queue and shift reminder push alerts using Serwist / Workbox. Must support sync when connectivity resumes.',
    columnId: 'todo',
    priority: 'high',
    assignee: MOCK_EMPLOYEES[5], // Mahbub
    reporter: MOCK_EMPLOYEES[1], // Tanvir
    estimatedHours: 12,
    spentProductionSeconds: 14400,
    dueDate: '2026-11-14',
    labels: ['PWA', 'ServiceWorker', 'Offline'],
    subtasks: [
      { id: 'st-1', text: 'Register service worker in main.tsx', completed: true },
      { id: 'st-2', text: 'Configure cache storage for app shell', completed: true },
      { id: 'st-3', text: 'Implement Web Push notifications API', completed: false }
    ],
    attachments: [
      {
        id: 'att-sc-1',
        name: 'pwa-manifest-audit.png',
        url: generateMockScreenshot('Lighthouse PWA Score 100%', '#10b981'),
        fileType: 'image/png',
        sizeBytes: 142800,
        uploadedAt: 'Today at 10:14 AM',
        uploadedBy: 'Mahbubur Rahman',
        isClipboardPaste: true
      }
    ],
    comments: [
      {
        id: 'c-1',
        authorId: 'u-2',
        authorName: 'Tanvir Hossain',
        authorAvatar: MOCK_EMPLOYEES[1].avatar,
        createdAt: 'Yesterday at 04:30 PM',
        text: 'Make sure the offline sync queue handles auto-break transitions gracefully if the user drops WiFi.'
      }
    ]
  },
  {
    id: 'VIVA-104',
    projectKey: 'PULSE',
    projectName: 'Vivacom Pulse Core',
    title: 'Attendance Break Lapses & Net Production Algorithm',
    description: 'Calculate net production seconds = gross time - total breaks. Auto-detect logout events, tab close heartbeats, and re-login lapses.',
    columnId: 'in_progress',
    priority: 'urgent',
    assignee: MOCK_EMPLOYEES[0], // Rafiq
    reporter: MOCK_EMPLOYEES[1],
    estimatedHours: 16,
    spentProductionSeconds: 19440,
    dueDate: '2026-11-12',
    labels: ['Backend', 'Attendance', 'Algorithm'],
    subtasks: [
      { id: 'st-4', text: 'Define state machine transitions', completed: true },
      { id: 'st-5', text: 'Implement 60s client heartbeat ping', completed: true },
      { id: 'st-6', text: 'Calculate gross minus total breaks formula', completed: true },
      { id: 'st-7', text: 'Handle 00:00 midnight shift turnover', completed: false }
    ],
    attachments: [
      {
        id: 'att-sc-2',
        name: 'break-interval-state-machine.png',
        url: generateMockScreenshot('State Machine Validation', '#6366f1'),
        fileType: 'image/png',
        sizeBytes: 215400,
        uploadedAt: 'Today at 09:45 AM',
        uploadedBy: 'Rafiq Ahmed',
        isClipboardPaste: true
      },
      {
        id: 'att-sc-3',
        name: 'midnight-rollover-test.png',
        url: generateMockScreenshot('Midnight Rollover Tests Passing', '#38bdf8'),
        fileType: 'image/png',
        sizeBytes: 189000,
        uploadedAt: 'Today at 11:20 AM',
        uploadedBy: 'Rafiq Ahmed',
        isClipboardPaste: false
      }
    ],
    comments: [
      {
        id: 'c-2',
        authorId: 'u-1',
        authorName: 'Rafiq Ahmed',
        authorAvatar: MOCK_EMPLOYEES[0].avatar,
        createdAt: 'Today at 11:25 AM',
        text: 'All unit test cases for the 60s heartbeat and 3-minute grace period on tab close are now passing!'
      }
    ]
  },
  {
    id: 'VIVA-108',
    projectKey: 'PULSE',
    projectName: 'Vivacom Pulse Core',
    title: 'Direct Clipboard "Ctrl+V" Screenshot Attachment Dock',
    description: 'Support seamless pasting of screenshots from clipboard directly into task modal. Must generate WebP thumbnail and store metadata.',
    columnId: 'in_progress',
    priority: 'high',
    assignee: MOCK_EMPLOYEES[4], // Farhana
    reporter: MOCK_EMPLOYEES[0],
    estimatedHours: 10,
    spentProductionSeconds: 17280,
    dueDate: '2026-11-13',
    labels: ['UI/UX', 'Clipboard', 'Kanban'],
    subtasks: [
      { id: 'st-8', text: 'Attach window paste event listener', completed: true },
      { id: 'st-9', text: 'Read image blob from clipboardData.items', completed: true },
      { id: 'st-10', text: 'Build image preview lightbox modal', completed: true }
    ],
    attachments: [
      {
        id: 'att-sc-4',
        name: 'clipboard-paste-listener.png',
        url: generateMockScreenshot('Clipboard Paste Event Listener', '#ec4899'),
        fileType: 'image/png',
        sizeBytes: 98400,
        uploadedAt: 'Today at 10:30 AM',
        uploadedBy: 'Farhana Yasmin',
        isClipboardPaste: true
      }
    ],
    comments: []
  },
  {
    id: 'VIVA-112',
    projectKey: 'PULSE',
    projectName: 'Vivacom Pulse Core',
    title: 'Branded PDF Payslip & Invoice Export Layout',
    description: 'Design pixel-perfect printable HTML/CSS templates for monthly payslips and client invoices with Vivacom official headers and tax tables.',
    columnId: 'review',
    priority: 'medium',
    assignee: MOCK_EMPLOYEES[6], // Sadia
    reporter: MOCK_EMPLOYEES[2], // Nasrin
    estimatedHours: 14,
    spentProductionSeconds: 18900,
    dueDate: '2026-11-11',
    labels: ['Billing', 'Payroll', 'PDF'],
    subtasks: [
      { id: 'st-11', text: 'Configure @media print CSS styles', completed: true },
      { id: 'st-12', text: 'Add BDT currency formatting and tax lines', completed: true },
      { id: 'st-13', text: 'Add official management signature stamp', completed: true }
    ],
    attachments: [
      {
        id: 'att-sc-5',
        name: 'invoice-print-preview.png',
        url: generateMockScreenshot('Invoice PDF Print Preview', '#f59e0b'),
        fileType: 'image/png',
        sizeBytes: 312000,
        uploadedAt: 'Today at 02:15 PM',
        uploadedBy: 'Sadia Sultana',
        isClipboardPaste: true
      }
    ],
    comments: [
      {
        id: 'c-3',
        authorId: 'u-3',
        authorName: 'Nasrin Akter',
        authorAvatar: MOCK_EMPLOYEES[2].avatar,
        createdAt: 'Today at 02:40 PM',
        text: 'Layout looks very professional! Please ensure the BDT currency symbol and VAT percentage are formatted correctly.'
      }
    ]
  },
  {
    id: 'VIVA-100',
    projectKey: 'PULSE',
    projectName: 'Vivacom Pulse Core',
    title: 'PostgreSQL Relational Schema & Migration Baseline',
    description: 'Set up tables for attendance_days, break_logs, work_sessions, tasks, payroll_runs, and client invoices.',
    columnId: 'done',
    priority: 'urgent',
    assignee: MOCK_EMPLOYEES[0],
    reporter: MOCK_EMPLOYEES[3],
    estimatedHours: 18,
    spentProductionSeconds: 21600,
    dueDate: '2026-11-09',
    labels: ['Database', 'Architecture'],
    subtasks: [
      { id: 'st-14', text: 'Draft ERD and foreign key constraints', completed: true },
      { id: 'st-15', text: 'Execute Prisma migration scripts', completed: true }
    ],
    attachments: [],
    comments: []
  }
];

export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 'lr-1',
    userId: 'u-5',
    userName: 'Farhana Yasmin',
    userAvatar: MOCK_EMPLOYEES[4].avatar,
    department: 'Engineering',
    type: 'Casual Leave',
    startDate: '2026-11-16',
    endDate: '2026-11-17',
    daysCount: 2,
    reason: 'Attending family wedding ceremony in Chattogram.',
    status: 'pending_tl',
    appliedAt: '2026-11-08'
  },
  {
    id: 'lr-2',
    userId: 'u-8',
    userName: 'Zahid Hasan',
    userAvatar: MOCK_EMPLOYEES[7].avatar,
    department: 'Infrastructure',
    type: 'Sick Leave',
    startDate: '2026-11-10',
    endDate: '2026-11-10',
    daysCount: 1,
    reason: 'Sudden fever and migraine; medical prescription uploaded.',
    status: 'pending_hr',
    appliedAt: '2026-11-10',
    tlApprovedBy: 'Tanvir Hossain'
  },
  {
    id: 'lr-3',
    userId: 'u-1',
    userName: 'Rafiq Ahmed',
    userAvatar: MOCK_EMPLOYEES[0].avatar,
    department: 'Engineering',
    type: 'Annual Leave',
    startDate: '2026-10-20',
    endDate: '2026-10-24',
    daysCount: 5,
    reason: 'Annual family vacation in Cox\'s Bazar.',
    status: 'approved',
    appliedAt: '2026-10-05',
    tlApprovedBy: 'Tanvir Hossain',
    hrApprovedBy: 'Nasrin Akter'
  }
];

export const INITIAL_PAYROLL_RECORDS: PayrollRecord[] = [
  {
    id: 'pr-1',
    userId: 'u-1',
    userName: 'Rafiq Ahmed',
    userAvatar: MOCK_EMPLOYEES[0].avatar,
    designation: 'Senior Full-Stack Engineer',
    department: 'Engineering',
    month: 'November 2026',
    baseSalary: 120000,
    salaryBreakdown: MOCK_EMPLOYEES[0].salary,
    standardHours: 176,
    actualProductionHours: 184, // 8h Overtime
    totalBreakHours: 24,
    overtimeHours: 8,
    overtimePay: 8180, // Overtime multiplier
    unpaidLeaveDays: 0,
    unpaidLeaveDeduction: 0,
    latePenaltyDeduction: 0,
    taxDeduction: 6000,
    performanceBonus: 10000,
    grossEarnings: 138180,
    totalDeductions: 6000,
    netPayable: 132180,
    paymentStatus: 'draft',
    bankAccountRef: 'City Bank •••• 2847'
  },
  {
    id: 'pr-2',
    userId: 'u-2',
    userName: 'Tanvir Hossain',
    userAvatar: MOCK_EMPLOYEES[1].avatar,
    designation: 'Engineering Lead & Scrum Master',
    department: 'Engineering',
    month: 'November 2026',
    baseSalary: 160000,
    salaryBreakdown: MOCK_EMPLOYEES[1].salary,
    standardHours: 176,
    actualProductionHours: 180,
    totalBreakHours: 22,
    overtimeHours: 4,
    overtimePay: 5450,
    unpaidLeaveDays: 0,
    unpaidLeaveDeduction: 0,
    latePenaltyDeduction: 0,
    taxDeduction: 10000,
    performanceBonus: 15000,
    grossEarnings: 180450,
    totalDeductions: 10000,
    netPayable: 170450,
    paymentStatus: 'approved',
    bankAccountRef: 'BRAC Bank •••• 8572'
  },
  {
    id: 'pr-5',
    userId: 'u-5',
    userName: 'Farhana Yasmin',
    userAvatar: MOCK_EMPLOYEES[4].avatar,
    designation: 'Frontend Engineer',
    department: 'Engineering',
    month: 'November 2026',
    baseSalary: 95000,
    salaryBreakdown: MOCK_EMPLOYEES[4].salary,
    standardHours: 176,
    actualProductionHours: 172,
    totalBreakHours: 28,
    overtimeHours: 0,
    overtimePay: 0,
    unpaidLeaveDays: 0,
    unpaidLeaveDeduction: 0,
    latePenaltyDeduction: 1500, // 3 late check-ins
    taxDeduction: 3500,
    performanceBonus: 5000,
    grossEarnings: 100000,
    totalDeductions: 5000,
    netPayable: 95000,
    paymentStatus: 'draft',
    bankAccountRef: 'Dutch-Bangla Bank •••• 8576'
  },
  {
    id: 'pr-8',
    userId: 'u-8',
    userName: 'Zahid Hasan',
    userAvatar: MOCK_EMPLOYEES[7].avatar,
    designation: 'DevOps & Cloud Engineer',
    department: 'Infrastructure',
    month: 'November 2026',
    baseSalary: 140000,
    salaryBreakdown: MOCK_EMPLOYEES[7].salary,
    standardHours: 176,
    actualProductionHours: 160,
    totalBreakHours: 20,
    overtimeHours: 0,
    overtimePay: 0,
    unpaidLeaveDays: 2,
    unpaidLeaveDeduction: 12720,
    latePenaltyDeduction: 0,
    taxDeduction: 7500,
    performanceBonus: 0,
    grossEarnings: 140000,
    totalDeductions: 20220,
    netPayable: 119780,
    paymentStatus: 'draft',
    bankAccountRef: 'City Bank •••• 2999'
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  // Internal Employee Monthly Salary Invoices (Staff invoice Vivacom for their production hours & monthly salary)
  {
    id: 'sal-101',
    invoiceNumber: 'SAL-2026-11-01',
    type: 'employee_salary',
    employeeId: 'u-1',
    employeeName: 'Rafiq Ahmed',
    employeeAvatar: MOCK_EMPLOYEES[0].avatar,
    designation: 'Senior Full-Stack Engineer',
    department: 'Engineering',
    billingMonth: 'November 2026',
    productionHours: 184,
    standardHours: 176,
    baseSalary: 120000,
    overtimeHours: 12,
    overtimePay: 8180,
    deductions: 0,
    netPayable: 128180,
    total: 128180,
    currency: 'BDT',
    issueDate: '2026-11-08',
    dueDate: '2026-11-15',
    status: 'verified_tl',
    tlVerifiedBy: 'Tariqul Islam (Engineering Lead)',
    tlVerifiedAt: '2026-11-09 11:20 AM',
    bankName: 'BRAC Bank Ltd (Gulshan Branch)',
    accountNumber: '1501-2049-8120',
    routingNumber: '060261724',
    scopeDescription: 'Senior full-stack engineering, WebSocket telematics engine, and PWA offline synchronizer development for Vivacom Pulse.',
    notes: 'Verified against attendance production hours log. Zero unexcused lapses.'
  },
  {
    id: 'sal-102',
    invoiceNumber: 'SAL-2026-11-02',
    type: 'employee_salary',
    employeeId: 'u-2',
    employeeName: 'Tanvir Hossain',
    employeeAvatar: MOCK_EMPLOYEES[1].avatar,
    designation: 'Frontend Engineer',
    department: 'Engineering',
    billingMonth: 'November 2026',
    productionHours: 172,
    standardHours: 176,
    baseSalary: 95000,
    overtimeHours: 0,
    overtimePay: 0,
    deductions: 5000,
    netPayable: 90000,
    total: 90000,
    currency: 'BDT',
    issueDate: '2026-11-08',
    dueDate: '2026-11-15',
    status: 'approved',
    tlVerifiedBy: 'Tariqul Islam',
    tlVerifiedAt: '2026-11-09 10:15 AM',
    managementApprovedBy: 'Nasrin Akter (HR & Finance)',
    managementApprovedAt: '2026-11-09 04:30 PM',
    bankName: 'City Bank Ltd (Principal Branch)',
    accountNumber: '2201-9842-1049',
    routingNumber: '225271849',
    scopeDescription: 'UI/UX refactoring, high-contrast theme systems, and interactive Kanban component engineering.',
    notes: 'Approved for wire disbursal batch. Unpaid leave deduction of 1 day applied.'
  },
  {
    id: 'sal-103',
    invoiceNumber: 'SAL-2026-11-03',
    type: 'employee_salary',
    employeeId: 'u-5',
    employeeName: 'Farhana Yasmin',
    employeeAvatar: MOCK_EMPLOYEES[4].avatar,
    designation: 'Mobile Application Engineer',
    department: 'Mobile Apps',
    billingMonth: 'November 2026',
    productionHours: 176,
    standardHours: 176,
    baseSalary: 110000,
    overtimeHours: 0,
    overtimePay: 0,
    deductions: 0,
    netPayable: 110000,
    total: 110000,
    currency: 'BDT',
    issueDate: '2026-11-09',
    dueDate: '2026-11-16',
    status: 'submitted',
    bankName: 'Eastern Bank Ltd (Banani Branch)',
    accountNumber: '1041-3920-5819',
    routingNumber: '090271382',
    scopeDescription: 'Android PWA packaging, offline storage sync hooks, and mobile push notification services.',
    notes: 'Submitted for monthly review. Attendance clock completed 100% of standard production hours.'
  },
  {
    id: 'sal-104',
    invoiceNumber: 'SAL-2026-11-04',
    type: 'employee_salary',
    employeeId: 'u-3',
    employeeName: 'Tariqul Islam',
    employeeAvatar: MOCK_EMPLOYEES[2].avatar,
    designation: 'Engineering Lead & Scrum Master',
    department: 'Engineering',
    billingMonth: 'November 2026',
    productionHours: 180,
    standardHours: 176,
    baseSalary: 160000,
    overtimeHours: 8,
    overtimePay: 5450,
    deductions: 10000,
    netPayable: 155450,
    total: 155450,
    currency: 'BDT',
    issueDate: '2026-11-01',
    dueDate: '2026-11-07',
    status: 'paid',
    tlVerifiedBy: 'Self (Lead Verified)',
    managementApprovedBy: 'Nasrin Akter (Director)',
    paidAt: '2026-11-07',
    bankName: 'Dutch-Bangla Bank Ltd (Gulshan Branch)',
    accountNumber: '1151-0391-8402',
    routingNumber: '085261491',
    scopeDescription: 'Technical architecture oversight, sprint execution, code review, and high-performance backend infrastructure delivery.',
    notes: 'Disbursed via automated BEFTN bank routing batch on Nov 07, 2026.'
  },

  // Commercial Client Invoices (Vivacom invoices external client companies for project scopes & retainers)
  {
    id: 'inv-101',
    invoiceNumber: 'INV-2026-089',
    type: 'client_project',
    clientName: 'Apex Telematics Global Ltd',
    clientEmail: 'billing@apextelematics.com',
    clientAddress: 'Level 14, Tower 2, Canary Wharf, London E14 5AB, United Kingdom',
    projectName: 'Fleet Telemetry & Real-Time Tracking Engine',
    billingPeriod: 'October 15, 2026 – November 15, 2026',
    issueDate: '2026-11-01',
    dueDate: '2026-11-20',
    status: 'submitted',
    currency: 'USD',
    total: 14700,
    netPayable: 14700,
    scopeDescription: 'Dedicated 4-engineer engineering team sprint retainer: Geo-fence WebSockets, MQTT vehicle telemetry engine, and real-time dashboard deliverable.',
    notes: 'Payment payable via international SWIFT Wire transfer to Vivacom City Bank USD account.'
  },
  {
    id: 'inv-102',
    invoiceNumber: 'INV-2026-088',
    type: 'client_project',
    clientName: 'Nordic Health Systems',
    clientEmail: 'finance@nordichealth.se',
    clientAddress: 'Vasagatan 16, 111 20 Stockholm, Sweden',
    projectName: 'Hospital Shift & Doctor On-Call Scheduling Suite',
    billingPeriod: 'September 01, 2026 – October 31, 2026',
    issueDate: '2026-10-15',
    dueDate: '2026-11-05',
    status: 'paid',
    currency: 'EUR',
    total: 12000,
    netPayable: 12000,
    paidAt: '2026-11-03',
    scopeDescription: 'Milestone 3 Deliverable: Automated On-Call Doctor Roster, SMS/Email notification pipeline, and FHIR API interoperability certified.',
    notes: 'Paid in full via SEPA Direct Bank Transfer on Nov 03, 2026.'
  }
];
